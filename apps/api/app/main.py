from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.admin import router as admin_router
from app.routers.health import router as health_router
from app.routers.modbus import router as modbus_router
from app.routers.ping import router as ping_router
from app.routers.terminal import router as terminal_router

app = FastAPI(title="Tools API")

# Browser Origin must be allowed for /health from the tools UI. Match localhost, loopback, common
# private LAN ranges, and Tailscale-style 100.x so dev works when you open Next via Network URL.
_PRIVATE_LAN_TAILSCALE_ORIGIN = (
    r"https?://("
    r"localhost|127\.0\.0\.1|"
    r"192\.168\.\d{1,3}\.\d{1,3}|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}|"
    r"100\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r")(:\d+)?$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ],
    allow_origin_regex=_PRIVATE_LAN_TAILSCALE_ORIGIN,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(admin_router)
app.include_router(ping_router)
app.include_router(modbus_router)
app.include_router(terminal_router)

