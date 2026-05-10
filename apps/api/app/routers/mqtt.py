"""MQTT explorer: browser WebSocket to paho-mqtt; optional SSH local port forward (asyncssh + PEM key)."""

from __future__ import annotations

import asyncio
import base64
import contextlib
import json
import logging
import uuid
from typing import Any

import asyncssh
import paho.mqtt.client as mqtt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.routers.terminal import _hop_kwargs, _parse_hop

logger = logging.getLogger(__name__)

router = APIRouter(tags=["mqtt"])


def _make_mqtt_client(client_id: str) -> mqtt.Client:
    try:
        from paho.mqtt.enums import CallbackAPIVersion

        return mqtt.Client(CallbackAPIVersion.VERSION2, client_id=client_id)
    except Exception:  # pragma: no cover - paho v1
        return mqtt.Client(client_id=client_id)


def _mqtt_connect_succeeded(rc: Any) -> bool:
    try:
        return not rc.is_failure
    except AttributeError:
        try:
            return int(rc) == 0
        except (TypeError, ValueError):
            return False


def _sub_unsub_result(result: Any) -> tuple[int, int]:
    """Normalize paho subscribe()/unsubscribe() return (may be tuple or result object)."""
    if isinstance(result, tuple) and len(result) >= 2:
        return int(result[0]), int(result[1])
    rc = getattr(result, "rc", result)
    mid = int(getattr(result, "mid", 0))
    return int(rc), mid


async def _setup_ssh_tunnel(params: dict[str, Any]) -> tuple[Any, asyncssh.SSHClientConnection, asyncssh.SSHClientConnection | None]:
    """Returns (listener, conn, jump_conn). listener has get_port() and close()."""
    trust_host = bool(params.get("trust_host", False))
    trust_jump_host = bool(params.get("trust_jump_host", False))

    target_raw = params.get("target")
    if not isinstance(target_raw, dict):
        raise ValueError("SSH tunnel requires a target object (host, port, username, password or private key).")

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

    jump_conn: asyncssh.SSHClientConnection | None = None
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

    fwd = params.get("forward") or {}
    dest_host = str(fwd.get("host", "127.0.0.1")).strip() or "127.0.0.1"
    dest_port = int(fwd.get("port", 1883))
    if not (1 <= dest_port <= 65535):
        raise ValueError("forward.port must be 1–65535.")

    listener = await conn.forward_local_port("127.0.0.1", 0, dest_host, dest_port)
    return listener, conn, jump_conn


@router.websocket("/mqtt/ws")
async def mqtt_ws(websocket: WebSocket) -> None:
    await websocket.accept()

    mqtt_client: mqtt.Client | None = None
    listener: Any = None
    conn: asyncssh.SSHClientConnection | None = None
    jump_conn: asyncssh.SSHClientConnection | None = None
    loop = asyncio.get_running_loop()

    async def send_safe(obj: dict[str, Any]) -> None:
        try:
            await websocket.send_json(obj)
        except Exception:
            logger.debug("mqtt ws send failed", exc_info=True)

    try:
        raw = await websocket.receive_text()
        params = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as e:
        await send_safe({"type": "error", "message": f"Invalid connect message: {e}"})
        await websocket.close(code=4000)
        return

    if params.get("type") != "connect":
        await send_safe({"type": "error", "message": "First message must be type=connect"})
        await websocket.close(code=4000)
        return

    mode = str(params.get("mode", "direct")).strip().lower()
    mqtt_host: str
    mqtt_port: int

    try:
        if mode == "ssh":
            listener, conn, jump_conn = await _setup_ssh_tunnel(params)
            mqtt_host = "127.0.0.1"
            mqtt_port = listener.get_port()
        elif mode == "direct":
            br = params.get("broker") or {}
            mqtt_host = str(br.get("host", "")).strip()
            p = int(br.get("port", 1883))
            if not mqtt_host:
                raise ValueError("broker.host is required for direct mode.")
            if not (1 <= p <= 65535):
                raise ValueError("broker.port must be 1–65535.")
            mqtt_port = p
        else:
            raise ValueError("mode must be direct or ssh.")
    except ValueError as e:
        await send_safe({"type": "error", "message": str(e)})
        await websocket.close(code=4000)
        return
    except Exception as e:
        logger.exception("MQTT SSH tunnel setup failed")
        await send_safe({"type": "error", "message": str(e)})
        await websocket.close(code=4001)
        return

    auth = params.get("mqtt_auth") or {}
    user = str(auth.get("username", "") or "").strip()
    password = str(auth.get("password", "") or "")
    raw_cid = str(auth.get("client_id", "") or "").strip()
    client_id = raw_cid or f"bsl-mqtt-{uuid.uuid4().hex[:10]}"

    connected = asyncio.Event()
    connect_err: list[str] = []
    connect_user_message: str | None = None

    def on_connect(client: mqtt.Client, userdata: Any, flags: Any, rc: Any, properties: Any = None) -> None:
        if _mqtt_connect_succeeded(rc):
            loop.call_soon_threadsafe(connected.set)
        else:
            connect_err.append(str(rc))
            loop.call_soon_threadsafe(connected.set)

    def on_message(_client: mqtt.Client, _userdata: Any, msg: Any) -> None:
        try:
            b64 = base64.b64encode(msg.payload).decode("ascii")
            asyncio.run_coroutine_threadsafe(
                send_safe(
                    {
                        "type": "message",
                        "topic": msg.topic,
                        "payload_b64": b64,
                        "qos": int(msg.qos),
                        "retain": bool(msg.retain),
                    }
                ),
                loop,
            )
        except Exception:
            logger.debug("mqtt on_message forward failed", exc_info=True)

    try:
        mqtt_client = _make_mqtt_client(client_id)
        mqtt_client.on_connect = on_connect
        mqtt_client.on_message = on_message
        if user:
            mqtt_client.username_pw_set(user, password)

        await asyncio.to_thread(mqtt_client.connect, mqtt_host, mqtt_port, 60)
        mqtt_client.loop_start()

        try:
            await asyncio.wait_for(connected.wait(), timeout=15.0)
        except asyncio.TimeoutError:
            connect_user_message = "MQTT connect timed out."

        if connect_user_message is None and connect_err:
            connect_user_message = f"MQTT connect failed: {connect_err[0]}"

        if connect_user_message is not None:
            await send_safe({"type": "error", "message": connect_user_message})
            raise RuntimeError(connect_user_message)

        await send_safe({"type": "connected", "mqtt_host": mqtt_host, "mqtt_port": mqtt_port, "mode": mode})
    except Exception as e:
        if mqtt_client:
            with contextlib.suppress(Exception):
                mqtt_client.loop_stop()
                mqtt_client.disconnect()
            mqtt_client = None
        if listener:
            with contextlib.suppress(Exception):
                listener.close()
            listener = None
        if conn:
            conn.close()
            conn = None
        if jump_conn:
            jump_conn.close()
            jump_conn = None
        if connect_user_message is None:
            await send_safe({"type": "error", "message": str(e)})
        with contextlib.suppress(Exception):
            await websocket.close(code=4001)
        return

    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
            except json.JSONDecodeError:
                await send_safe({"type": "error", "message": "Invalid JSON"})
                continue

            mtype = str(msg.get("type", "")).strip().lower()
            if mtype == "subscribe":
                topic = str(msg.get("topic", "")).strip()
                if not topic:
                    await send_safe({"type": "error", "message": "subscribe requires topic"})
                    continue
                qos = max(0, min(2, int(msg.get("qos", 0))))
                r, mid = _sub_unsub_result(mqtt_client.subscribe(topic, qos))
                if r != mqtt.MQTT_ERR_SUCCESS:
                    await send_safe({"type": "error", "message": f"subscribe failed: {r}"})
                else:
                    await send_safe({"type": "subscribed", "topic": topic, "qos": qos, "mid": mid})
            elif mtype == "unsubscribe":
                topic = str(msg.get("topic", "")).strip()
                if not topic:
                    await send_safe({"type": "error", "message": "unsubscribe requires topic"})
                    continue
                r, mid = _sub_unsub_result(mqtt_client.unsubscribe(topic))
                if r != mqtt.MQTT_ERR_SUCCESS:
                    await send_safe({"type": "error", "message": f"unsubscribe failed: {r}"})
                else:
                    await send_safe({"type": "unsubscribed", "topic": topic, "mid": mid})
            elif mtype == "publish":
                topic = str(msg.get("topic", "")).strip()
                if not topic:
                    await send_safe({"type": "error", "message": "publish requires topic"})
                    continue
                enc = str(msg.get("payload_encoding", "utf8")).strip().lower()
                if enc == "base64":
                    raw_b = base64.b64decode(str(msg.get("payload", "") or ""), validate=True)
                else:
                    raw_b = str(msg.get("payload", "") or "").encode("utf-8")
                qos = max(0, min(2, int(msg.get("qos", 0))))
                retain = bool(msg.get("retain", False))
                mqtt_client.publish(topic, raw_b, qos, retain)
                await send_safe({"type": "published", "topic": topic})
            elif mtype == "ping":
                await send_safe({"type": "pong"})
            else:
                await send_safe({"type": "error", "message": f"Unknown type: {mtype}"})
    except WebSocketDisconnect:
        pass
    finally:
        if mqtt_client:
            with contextlib.suppress(Exception):
                mqtt_client.loop_stop()
                mqtt_client.disconnect()
        if listener:
            with contextlib.suppress(Exception):
                listener.close()
        if conn:
            conn.close()
        if jump_conn:
            jump_conn.close()
        with contextlib.suppress(Exception):
            await websocket.close()
