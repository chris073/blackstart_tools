import asyncio
import json
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.ping_check import (
    MAX_PING_TARGETS,
    check_host,
    check_many,
    expand_subnet,
    normalize_tcp_ports,
    result_dict,
)
from app.services.ping_check import PingStatus

router = APIRouter(prefix="/ping", tags=["ping"])


class PingTargetIn(BaseModel):
    tag: str = Field(..., min_length=1, max_length=128)
    host: str = Field(..., min_length=1, max_length=253)


class PingCheckRequest(BaseModel):
    """Provide either a subnet (CIDR) or an explicit list of tag/host pairs."""

    subnet: Optional[str] = Field(None, max_length=64)
    targets: Optional[List[PingTargetIn]] = None
    tcp_ports: Optional[List[int]] = Field(None, max_length=64)


class PingResultOut(BaseModel):
    tag: str
    host: str
    status: str
    rtt_ms: Optional[float] = None
    open_ports: List[int] = Field(default_factory=list)
    detail: Optional[str] = None


class PingCheckResponse(BaseModel):
    results: List[PingResultOut]
    count: int


def _normalize_items(req: PingCheckRequest) -> List[tuple]:
    if req.subnet and req.targets:
        raise HTTPException(status_code=400, detail="Send either subnet or targets, not both.")
    if req.subnet:
        try:
            ips = expand_subnet(req.subnet)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        if not ips:
            raise HTTPException(status_code=400, detail="No addresses to scan for that subnet.")
        return [(ip, ip) for ip in ips]
    if req.targets:
        items: List[tuple] = []
        for t in req.targets:
            tag = t.tag.strip()
            host = t.host.strip()
            if not tag or not host:
                continue
            items.append((tag, host))
        if not items:
            raise HTTPException(status_code=400, detail="No valid targets after parsing.")
        if len(items) > MAX_PING_TARGETS:
            raise HTTPException(
                status_code=400,
                detail=f"Too many targets ({len(items)}). Max is {MAX_PING_TARGETS}.",
            )
        return items
    raise HTTPException(status_code=400, detail="Provide subnet or targets.")


def _ports_tuple(body: PingCheckRequest) -> tuple:
    try:
        return normalize_tcp_ports(body.tcp_ports)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/check", response_model=PingCheckResponse)
async def ping_check(body: PingCheckRequest) -> PingCheckResponse:
    items = _normalize_items(body)
    ports = _ports_tuple(body)
    if len(items) > MAX_PING_TARGETS:
        raise HTTPException(
            status_code=400,
            detail=f"Too many targets ({len(items)}). Max is {MAX_PING_TARGETS}.",
        )
    raw = await check_many(items, ports)
    results = [PingResultOut(**r) for r in raw]
    return PingCheckResponse(results=results, count=len(results))


@router.post("/check/stream")
async def ping_check_stream(request: Request, body: PingCheckRequest) -> StreamingResponse:
    """
    NDJSON stream of ping results; stops early when the client disconnects (Stop in UI aborts fetch).
    Each line is JSON with an "event" field: start, result, or end.
    """
    items = _normalize_items(body)
    ports = _ports_tuple(body)
    if len(items) > MAX_PING_TARGETS:
        raise HTTPException(
            status_code=400,
            detail=f"Too many targets ({len(items)}). Max is {MAX_PING_TARGETS}.",
        )

    sem = asyncio.Semaphore(48)

    async def run_one(tag: str, host: str) -> dict:
        async with sem:
            st, rtt, open_ports = await check_host(host, ports)
            return result_dict(tag, host, st, rtt, open_ports)

    async def ndjson():
        yield json.dumps({"event": "start", "total": len(items)}) + "\n"
        pending: Dict[asyncio.Task, tuple] = {
            asyncio.create_task(run_one(t, h)): (t, h) for t, h in items
        }
        cancelled = False
        try:
            while pending:
                if await request.is_disconnected():
                    cancelled = True
                    for t in list(pending.keys()):
                        t.cancel()
                    break
                done, _ = await asyncio.wait(
                    set(pending.keys()),
                    return_when=asyncio.FIRST_COMPLETED,
                    timeout=0.25,
                )
                for task in done:
                    tag, host = pending.pop(task)
                    try:
                        result = task.result()
                        yield json.dumps({"event": "result", **result}) + "\n"
                    except asyncio.CancelledError:
                        pass
                    except Exception as exc:  # pragma: no cover
                        err_row = {**result_dict(tag, host, PingStatus.down, None, []), "detail": str(exc)}
                        yield json.dumps(err_row) + "\n"
        finally:
            for t in list(pending.keys()):
                t.cancel()
            if pending:
                await asyncio.gather(*pending.keys(), return_exceptions=True)
            yield json.dumps({"event": "end", "cancelled": cancelled}) + "\n"

    return StreamingResponse(ndjson(), media_type="application/x-ndjson")
