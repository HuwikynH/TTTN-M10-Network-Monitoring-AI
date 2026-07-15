import os
from dataclasses import dataclass


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
    latency_warning_ms: float = float(os.getenv("LATENCY_WARNING_MS", "100"))
    packet_loss_warning_percent: float = float(os.getenv("PACKET_LOSS_WARNING_PERCENT", "20"))
    cpu_warning_percent: float = float(os.getenv("CPU_WARNING_PERCENT", "90"))
    memory_warning_percent: float = float(os.getenv("MEMORY_WARNING_PERCENT", "90"))
    device_stale_seconds: int = int(os.getenv("DEVICE_STALE_SECONDS", "45"))


settings = Settings()
