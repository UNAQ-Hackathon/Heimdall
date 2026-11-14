from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import firehazr, flammability, health, trends

app = FastAPI(
    title="Heimdall Analytics",
    description="Combustion data analysis engine — trends, flammability maps, statistics",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(firehazr.router, prefix="/api/analytics")
app.include_router(trends.router, prefix="/api/analytics")
app.include_router(flammability.router, prefix="/api/analytics")
