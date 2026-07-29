import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env", override=False)


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


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
    telegram_enabled: bool = env_bool("TELEGRAM_ENABLED", False)
    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    telegram_chat_id: str = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    telegram_timeout_seconds: float = max(
        1.0, float(os.getenv("TELEGRAM_TIMEOUT_SECONDS", "5"))
    )
    telegram_notify_recovery: bool = env_bool(
        "TELEGRAM_NOTIFY_RECOVERY", True
    )
    telegram_dashboard_url: str = os.getenv(
        "TELEGRAM_DASHBOARD_URL", ""
    ).strip()


settings = Settings()
