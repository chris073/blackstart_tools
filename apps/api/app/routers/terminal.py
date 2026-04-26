"""Browser SSH terminal: WebSocket bridge to remote shell via asyncssh."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from typing import Any

import asyncssh
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["terminal"])


class TrustAnyHostKey(asyncssh.SSHClient):
    def validate_host_public_key(
        self,
        host: str,
        addr: str,
        port: int,
        algorithm: str,
        key: asyncssh.SSHKey,
    ) -> bool:
        return True


def _load_client_keys(pem: str | None, passphrase: str | None) -> list[Any]:
    if not pem or not str(pem).strip():
        return []
    pp = passphrase.strip() if passphrase else None
    if pp == "":
        pp = None
    try:
        key = asyncssh.import_private_key(pem.strip(), passphrase=pp)
    except Exception as e:
        raise ValueError(f"Could not load private key (wrong format or passphrase?): {e}") from e
    return [key]


def _hop_kwargs(
    *,
    host: str,
    port: int,
    username: str,
    password: str,
    private_key_pem: str,
    private_key_passphrase: str,
    trust: bool,
    tunnel: asyncssh.SSHClientConnection | None = None,
) -> dict[str, Any]:
    keys = _load_client_keys(private_key_pem, private_key_passphrase)
    if not keys and not (password and password.strip()):
        raise ValueError("Each SSH hop needs a password or a private key (PEM).")
    kw: dict[str, Any] = {
        "host": host.strip(),
        "port": port,
        "username": username.strip(),
        "known_hosts": None,
    }
    if tunnel is not None:
        kw["tunnel"] = tunnel
    if keys:
        kw["client_keys"] = keys
    if password and password.strip():
        kw["password"] = password
    if trust:
        kw["client_factory"] = TrustAnyHostKey
    return kw


def _parse_hop(prefix: str, d: dict[str, Any]) -> tuple[str, int, str, str, str, str]:
    host = str(d.get("host", "")).strip()
    port = int(d.get("port", 22))
    username = str(d.get("username", "")).strip()
    password = str(d.get("password", "") or "")
    pem = str(d.get("private_key_pem", "") or "")
    ppass = str(d.get("private_key_passphrase", "") or "")
    if not host or not username:
        raise ValueError(f"{prefix}: host and username are required.")
    if not (1 <= port <= 65535):
        raise ValueError(f"{prefix}: port must be 1–65535.")
    return host, port, username, password, pem, ppass


@router.websocket("/terminal/ws")
async def terminal_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    process: asyncssh.SSHClientProcess | None = None
    conn: asyncssh.SSHClientConnection | None = None
    jump_conn: asyncssh.SSHClientConnection | None = None

    try:
        raw = await websocket.receive_text()
        params = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as e:
        await websocket.send_text(json.dumps({"type": "error", "message": f"Invalid connect message: {e}"}))
        await websocket.close(code=4000)
        return

    if params.get("type") != "connect":
        await websocket.send_text(json.dumps({"type": "error", "message": "First message must be type=connect"}))
        await websocket.close(code=4000)
        return

    cols = max(20, min(int(params.get("cols", 80)), 500))
    rows = max(5, min(int(params.get("rows", 24)), 200))
    trust_host = bool(params.get("trust_host", False))
    trust_jump_host = bool(params.get("trust_jump_host", False))

    target_raw = params.get("target")
    if not isinstance(target_raw, dict):
        await websocket.send_text(json.dumps({"type": "error", "message": "Missing or invalid target object"}))
        await websocket.close(code=4000)
        return

    try:
        th, tp, tu, t_pw, t_pem, t_ppass = _parse_hop("Target", target_raw)
        target_kw = _hop_kwargs(
            host=th,
            port=tp,
            username=tu,
            password=t_pw,
            private_key_pem=t_pem,
            private_key_passphrase=t_ppass,
            trust=trust_host,
            tunnel=None,
        )

        jump_raw = params.get("jump")
        if isinstance(jump_raw, dict) and str(jump_raw.get("host", "")).strip():
            jh, jp, ju, j_pw, j_pem, j_ppass = _parse_hop("Jump host", jump_raw)
            jump_kw = _hop_kwargs(
                host=jh,
                port=jp,
                username=ju,
                password=j_pw,
                private_key_pem=j_pem,
                private_key_passphrase=j_ppass,
                trust=trust_jump_host,
                tunnel=None,
            )
            jump_conn = await asyncssh.connect(**jump_kw)
            target_kw["tunnel"] = jump_conn

        conn = await asyncssh.connect(**target_kw)
        process = await conn.create_process(
            term_type="xterm-256color",
            term_size=(cols, rows, 0, 0),
        )
    except ValueError as e:
        await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        await websocket.close(code=4000)
        return
    except Exception as e:
        logger.exception("SSH connect failed")
        await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        await websocket.close(code=4001)
        return

    await websocket.send_text(json.dumps({"type": "connected"}))

    stdin = process.stdin
    stdout = process.stdout
    assert stdin is not None and stdout is not None

    stop = asyncio.Event()

    async def ws_to_ssh() -> None:
        try:
            while not stop.is_set():
                msg = await websocket.receive()
                if msg["type"] == "websocket.disconnect":
                    break
                if "bytes" in msg and msg["bytes"] is not None:
                    stdin.write(msg["bytes"])
                elif "text" in msg and msg["text"] is not None:
                    text = msg["text"]
                    try:
                        ctrl = json.loads(text)
                        if ctrl.get("type") == "resize":
                            c = max(20, min(int(ctrl.get("cols", 80)), 500))
                            r = max(5, min(int(ctrl.get("rows", 24)), 200))
                            process.change_terminal_size(c, r, 0, 0)
                    except (json.JSONDecodeError, TypeError, ValueError):
                        stdin.write(text.encode("utf-8", errors="replace"))
        except WebSocketDisconnect:
            pass
        finally:
            stop.set()

    async def ssh_to_ws() -> None:
        try:
            while not stop.is_set():
                data = await stdout.read(4096)
                if not data:
                    break
                await websocket.send_bytes(data)
        except Exception:
            logger.exception("ssh_to_ws error")
        finally:
            stop.set()

    t1 = asyncio.create_task(ws_to_ssh())
    t2 = asyncio.create_task(ssh_to_ws())
    try:
        await stop.wait()
    finally:
        t1.cancel()
        t2.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await t1
        with contextlib.suppress(asyncio.CancelledError):
            await t2
        if process:
            process.close()
        if conn:
            conn.close()
        if jump_conn:
            jump_conn.close()
        with contextlib.suppress(Exception):
            await websocket.close()
