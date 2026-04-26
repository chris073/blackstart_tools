"""Host reachability: ICMP via system ping, TCP connect checks on configured ports."""

from __future__ import annotations

import asyncio
import ipaddress
import platform
import re
import socket
import subprocess
from enum import Enum
from typing import Iterable, List, Optional

MAX_PING_TARGETS = 512
DEFAULT_TCP_PORTS: tuple[int, ...] = (23, 443, 502, 4712, 8080, 20000)
MAX_TCP_PORTS = 64
TCP_CONNECT_TIMEOUT_SEC = 1.0
ICMP_TIMEOUT_SEC = 2.0


class PingStatus(str, Enum):
    icmp_ok = "icmp_ok"
    tcp_only = "tcp_only"
    down = "down"


def expand_subnet(cidr: str) -> list[str]:
    net = ipaddress.ip_network(cidr.strip(), strict=False)
    if net.num_addresses > MAX_PING_TARGETS:
        raise ValueError(
            f"Subnet has {int(net.num_addresses)} addresses (max {MAX_PING_TARGETS}). "
            "Use a longer prefix."
        )
    out: list[str] = []
    if net.prefixlen == net.max_prefixlen:
        out.append(str(net.network_address))
        return out
    for ip in net.hosts():
        out.append(str(ip))
        if len(out) >= MAX_PING_TARGETS:
            break
    return out


def normalize_tcp_ports(ports: Optional[List[int]]) -> tuple[int, ...]:
    """Dedupe, validate range; empty / invalid falls back to DEFAULT_TCP_PORTS."""
    if not ports:
        return DEFAULT_TCP_PORTS
    out: list[int] = []
    seen: set[int] = set()
    for p in ports:
        if not isinstance(p, int) or not (1 <= p <= 65535):
            continue
        if p in seen:
            continue
        seen.add(p)
        out.append(p)
        if len(out) > MAX_TCP_PORTS:
            raise ValueError(f"Too many tcp_ports (max {MAX_TCP_PORTS}).")
    return tuple(out) if out else DEFAULT_TCP_PORTS


def _ping_command(host: str) -> list[str]:
    sysname = platform.system()
    if sysname == "Windows":
        ms = max(1000, int(ICMP_TIMEOUT_SEC * 1000))
        return ["ping", "-n", "1", "-w", str(ms), host]
    if sysname == "Darwin":
        ms = max(500, int(ICMP_TIMEOUT_SEC * 1000))
        return ["ping", "-c", "1", "-W", str(ms), host]
    w = max(1, int(ICMP_TIMEOUT_SEC))
    return ["ping", "-c", "1", "-W", str(w), host]


def _parse_rtt_ms(stdout: str) -> float | None:
    text = stdout.replace("\r", "")
    m = re.search(r"time[=<]\s*(\d+(?:\.\d+)?)\s*ms", text, re.IGNORECASE)
    if m:
        return float(m.group(1))
    if re.search(r"time\s*<\s*1\s*ms", text, re.IGNORECASE):
        return 0.5
    m2 = re.search(r"=\s*(\d+(?:\.\d+)?)\s*ms", text)
    if m2:
        return float(m2.group(1))
    return None


def icmp_ping(host: str) -> tuple[bool, float | None]:
    cmd = _ping_command(host)
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=ICMP_TIMEOUT_SEC + 1.5,
            encoding="utf-8",
            errors="replace",
        )
    except FileNotFoundError:
        return False, None
    except subprocess.TimeoutExpired:
        return False, None
    out = (proc.stdout or "") + (proc.stderr or "")
    ok = proc.returncode == 0
    rtt = _parse_rtt_ms(out) if ok else None
    return ok, rtt


def tcp_probe_ports(host: str, ports: Iterable[int]) -> list[int]:
    """Return ports from the list that accept a TCP connection."""
    open_ports: list[int] = []
    for port in ports:
        try:
            with socket.create_connection((host, port), timeout=TCP_CONNECT_TIMEOUT_SEC):
                open_ports.append(port)
        except OSError:
            continue
    return open_ports


def check_host_sync(host: str, tcp_ports: tuple[int, ...]) -> tuple[PingStatus, float | None, list[int]]:
    icmp_ok, rtt = icmp_ping(host)
    open_ports = tcp_probe_ports(host, tcp_ports)
    if icmp_ok:
        return PingStatus.icmp_ok, rtt, open_ports
    if open_ports:
        return PingStatus.tcp_only, None, open_ports
    return PingStatus.down, None, open_ports


async def check_host(host: str, tcp_ports: tuple[int, ...]) -> tuple[PingStatus, float | None, list[int]]:
    return await asyncio.to_thread(check_host_sync, host, tcp_ports)


def result_dict(tag: str, host: str, status: PingStatus, rtt: float | None, open_ports: list[int]) -> dict:
    return {
        "tag": tag,
        "host": host,
        "status": status.value,
        "rtt_ms": rtt,
        "open_ports": open_ports,
        "detail": None,
    }


async def check_many(
    items: list[tuple[str, str]],
    tcp_ports: tuple[int, ...],
    concurrency: int = 48,
) -> list[dict]:
    sem = asyncio.Semaphore(concurrency)

    async def one(tag: str, host: str) -> dict:
        async with sem:
            st, rtt, ports = await check_host(host, tcp_ports)
        return result_dict(tag, host, st, rtt, ports)

    return await asyncio.gather(*[one(t, h) for t, h in items])
