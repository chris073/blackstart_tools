from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.athena import router as athena_router
from app.routers.health import router as health_router

app = FastAPI(title="indie-tools api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(athena_router)

