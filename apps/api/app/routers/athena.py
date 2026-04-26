from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.athena_config import load_database_names_for_dropdown
from app.services.athena_core import (
    build_device_json_keys_query,
    build_timeseries_compare_query,
    run_athena_query,
)

router = APIRouter(prefix="/athena", tags=["athena"])


class RunQueryRequest(BaseModel):
    query: str = Field(..., min_length=1)


class RunQueryResponse(BaseModel):
    rows: List[List[str]]
    message: str


class DatabasesResponse(BaseModel):
    items: List[str]
    message: str
    source_path: str = ""


class KeysResponse(BaseModel):
    """Keys discovery: distinct key names plus full result grid for output/Excel."""

    items: List[str]
    sql: str
    message: str
    rows: List[List[str]]


class BuilderRow(BaseModel):
    device_id: str = ""
    json_key: str = ""
    labels: str = ""


class BuildTimeseriesRequest(BaseModel):
    database: str = Field(..., min_length=1)
    start: str = Field(..., min_length=1)
    end: str = Field(..., min_length=1)
    rows: List[BuilderRow] = Field(..., min_length=1)


class BuildTimeseriesResponse(BaseModel):
    sql: str
    expanded_pairs: List[List[str]]


def _split_labels_or_key(labels: str, json_key: str) -> List[str]:
    lab = (labels or "").strip()
    if lab:
        if lab == "*":
            return ["*"]
        parts = [p.strip() for p in lab.split(",")]
        return [p for p in parts if p]
    jk = (json_key or "").strip()
    return [jk] if jk else []


@router.get("/databases", response_model=DatabasesResponse)
def databases() -> DatabasesResponse:
    items, msg, path = load_database_names_for_dropdown()
    return DatabasesResponse(items=items, message=msg, source_path=path or "")


@router.post("/run", response_model=RunQueryResponse)
def run(req: RunQueryRequest) -> RunQueryResponse:
    rows, msg = run_athena_query(req.query)
    return RunQueryResponse(rows=rows, message=msg)


@router.get("/keys", response_model=KeysResponse)
def keys(database: str, device_id: str, start: str) -> KeysResponse:
    sql = build_device_json_keys_query(database, device_id, start)
    rows, msg = run_athena_query(sql)
    items = [r[0] for r in (rows[1:] if len(rows) > 1 else []) if r and (r[0] or "").strip()]
    return KeysResponse(items=sorted(set(items)), sql=sql, message=msg, rows=rows)


@router.post("/build/timeseries-compare", response_model=BuildTimeseriesResponse)
def build_timeseries(req: BuildTimeseriesRequest) -> BuildTimeseriesResponse:
    key_re = __import__("re").compile(r"^[a-zA-Z0-9_.]+$")

    expanded: List[List[str]] = []
    pairs: List[tuple] = []
    for idx, r in enumerate(req.rows):
        dev = (r.device_id or "").strip()
        if not dev:
            continue
        keys = _split_labels_or_key(r.labels, r.json_key)
        if not keys:
            continue

        if "*" in keys:
            sql = build_device_json_keys_query(req.database, dev, req.start)
            rows, msg = run_athena_query(sql)
            if not rows:
                raise HTTPException(
                    status_code=400,
                    detail="Row {}: failed to load keys for * ({})".format(idx + 1, msg),
                )
            klist = [x[0] for x in rows[1:] if x and (x[0] or "").strip()]
            keys = sorted(set(klist))

        for k in keys:
            k = (k or "").strip()
            if not k:
                continue
            if not key_re.match(k):
                raise HTTPException(status_code=400, detail="Row {}: invalid key {!r}".format(idx + 1, k))
            pairs.append((dev, k))
            expanded.append([dev, k])

    if not pairs:
        raise HTTPException(status_code=400, detail="No series rows (device_id + json key or labels).")

    sql = build_timeseries_compare_query(req.database, req.start, req.end, pairs)
    return BuildTimeseriesResponse(sql=sql, expanded_pairs=expanded)

