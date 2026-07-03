from app import models, schemas
from app.config import settings


def build_metric_alerts(metric: schemas.MetricCreate) -> list[models.Alert]:
    """Build rule-based alerts for one metric sample without committing them."""
    alerts: list[models.Alert] = []

    def add(level: str, message: str) -> None:
        alerts.append(models.Alert(device_id=metric.device_id, level=level, message=message))

    if metric.packet_loss_percent == 100:
        add("critical", "Thiết bị mất kết nối (packet loss 100%).")
    elif (
        metric.packet_loss_percent is not None
        and metric.packet_loss_percent >= settings.packet_loss_warning_percent
    ):
        add("warning", f"Packet loss cao: {metric.packet_loss_percent:.1f}%.")

    if metric.latency_ms is not None and metric.latency_ms >= settings.latency_warning_ms:
        add("warning", f"Latency cao: {metric.latency_ms:.1f} ms.")
    if metric.cpu_percent is not None and metric.cpu_percent >= settings.cpu_warning_percent:
        add("warning", f"CPU cao: {metric.cpu_percent:.1f}%.")
    if metric.memory_percent is not None and metric.memory_percent >= settings.memory_warning_percent:
        add("warning", f"Bộ nhớ cao: {metric.memory_percent:.1f}%.")

    return alerts
