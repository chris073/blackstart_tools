from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.athena import router as athena_router
from app.routers.health import router as health_router

app = FastAPI(title="Blackstart Tools API")

# Browser Origin must match exactly; dev servers often use 127.0.0.1 vs localhost or alternate ports.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(athena_router)

