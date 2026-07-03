from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router
from app.config import settings
from app.database import Base, engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Backend API for the TTTN M10 network monitoring project.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.get("/", tags=["System"])
def root() -> dict[str, str]:
    return {"name": settings.app_name, "status": "OK", "docs": "/docs"}


@app.get("/health", tags=["System"])
def health() -> dict[str, str]:
    return {"status": "healthy", "environment": settings.app_env}
