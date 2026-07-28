import os
from dataclasses import dataclass
from pathlib import Path


DEFAULT_AI_MODEL_PATH = (
    Path(__file__).resolve().parents[2] / "ai" / "models" / "scenario_random_forest.joblib"
)


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "TTTN M10 Network Monitoring AI")
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./network_monitoring.db")
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    )
    device_stale_seconds: int = int(os.getenv("DEVICE_STALE_SECONDS", "45"))
    ai_model_path: str = os.getenv("AI_MODEL_PATH", str(DEFAULT_AI_MODEL_PATH))


settings = Settings()
