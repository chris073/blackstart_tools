"""Dev-only endpoints (guarded by env)."""

import os
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/admin", tags=["admin"])

_RELOAD_ENV = "BLACKSTART_ALLOW_RELOAD"


def _reload_touch_path() -> Path:
    """Gitignored; under app/ so uvicorn --reload-dir app picks it up."""
    return Path(__file__).resolve().parent.parent / ".reload_touch"


@router.post("/reload")
def trigger_uvicorn_reload() -> dict:
    """
    Update a file under --reload-dir so uvicorn's reloader restarts the worker process.
    The supervisor keeps the listen socket (avoids port stuck from a full stop on Windows).
    No-op with --no-reload (endpoint returns 404 unless BLACKSTART_ALLOW_RELOAD=1).
    """
    if os.environ.get(_RELOAD_ENV) != "1":
        raise HTTPException(status_code=404, detail="Not found")
    path = _reload_touch_path()
    path.write_text(f"{time.time()}\n", encoding="utf-8")
    return {"ok": True, "detail": "reload_triggered"}
