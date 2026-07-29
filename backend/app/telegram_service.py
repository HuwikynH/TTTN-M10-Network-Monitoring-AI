from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

VIETNAM_TIMEZONE = timezone(timedelta(hours=7))
SCENARIO_NAMES = {
    "baseline": "Bình thường",
    "stress_cpu": "Tải CPU cao",
    "high_traffic": "Lưu lượng cao",
    "high_latency": "Độ trễ cao",
    "packet_loss": "Mất gói",
    "attack_test": "Dấu hiệu tấn công",
}


@dataclass(frozen=True)
class TelegramDeliveryResult:
    status: str
    detail: str

    @property
    def sent(self) -> bool:
        return self.status == "sent"

    def as_dict(self) -> dict[str, str]:
        return asdict(self)


def telegram_status() -> dict[str, bool]:
    return {
        "enabled": settings.telegram_enabled,
        "configured": bool(
            settings.telegram_bot_token and settings.telegram_chat_id
        ),
        "notify_recovery": settings.telegram_notify_recovery,
        "dashboard_url_configured": bool(settings.telegram_dashboard_url),
    }


def _send_message(text: str) -> TelegramDeliveryResult:
    if not settings.telegram_enabled:
        return TelegramDeliveryResult("disabled", "Telegram is disabled")
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return TelegramDeliveryResult(
            "not_configured",
            "Telegram bot token or chat ID is missing",
        )

    url = (
        "https://api.telegram.org/bot"
        f"{settings.telegram_bot_token}/sendMessage"
    )
    payload = {
        "chat_id": settings.telegram_chat_id,
        "text": text,
        "disable_web_page_preview": True,
    }
    try:
        response = httpx.post(
            url,
            json=payload,
            timeout=settings.telegram_timeout_seconds,
        )
    except httpx.HTTPError as error:
        # The exception URL contains the bot token, so do not log the exception.
        logger.warning(
            "Telegram delivery failed because of %s",
            type(error).__name__,
        )
        return TelegramDeliveryResult(
            "delivery_failed",
            "Could not reach Telegram Bot API",
        )

    if response.status_code >= 400:
        logger.warning(
            "Telegram Bot API rejected a message with HTTP %s",
            response.status_code,
        )
        return TelegramDeliveryResult(
            "delivery_failed",
            f"Telegram Bot API returned HTTP {response.status_code}",
        )

    try:
        response_payload = response.json()
    except ValueError:
        return TelegramDeliveryResult(
            "delivery_failed",
            "Telegram Bot API returned invalid JSON",
        )
    if not response_payload.get("ok"):
        return TelegramDeliveryResult(
            "delivery_failed",
            "Telegram Bot API rejected the message",
        )

    logger.info("Telegram notification delivered")
    return TelegramDeliveryResult("sent", "Telegram message sent")


def _format_number(
    data: Mapping[str, Any],
    key: str,
    label: str,
    suffix: str,
) -> str | None:
    value = data.get(key)
    if value is None:
        return None
    return f"{label}: {float(value):.2f}{suffix}"


def _metric_lines(data: Mapping[str, Any]) -> list[str]:
    definitions = [
        ("cpu_percent", "CPU", "%"),
        ("memory_percent", "RAM", "%"),
        ("traffic_in_mbps", "Traffic in", " Mbps"),
        ("traffic_out_mbps", "Traffic out", " Mbps"),
        ("latency_ms", "Latency", " ms"),
        ("packet_loss_percent", "Packet loss", "%"),
    ]
    return [
        line
        for key, label, suffix in definitions
        if (line := _format_number(data, key, label, suffix)) is not None
    ]


def _event_time(data: Mapping[str, Any]) -> str:
    value = data.get("collected_at")
    if isinstance(value, datetime):
        event_time = value
    else:
        event_time = datetime.now(timezone.utc)
    if event_time.tzinfo is None:
        event_time = event_time.replace(tzinfo=timezone.utc)
    return event_time.astimezone(VIETNAM_TIMEZONE).strftime(
        "%d/%m/%Y %H:%M:%S"
    )


def _dashboard_line() -> str | None:
    if not settings.telegram_dashboard_url:
        return None
    return f"Dashboard: {settings.telegram_dashboard_url}"


def notify_ai_alert(data: Mapping[str, Any]) -> TelegramDeliveryResult:
    scenario = str(data.get("top_scenario", "unknown"))
    level = str(data.get("level", "warning")).upper()
    lines = [
        f"[{level}] CẢNH BÁO GIÁM SÁT MẠNG",
        "",
        f"Thiết bị: {data.get('device_name', 'Không rõ')}",
        f"IP: {data.get('ip_address', 'Không rõ')}",
        f"Sự cố: {SCENARIO_NAMES.get(scenario, scenario)}",
        f"Risk score: {float(data.get('risk_score', 0)):.1f}%",
        (
            "Độ tin cậy: "
            f"{float(data.get('top_scenario_confidence', 0)):.1f}%"
        ),
        "",
        *_metric_lines(data),
        "",
        f"Thời gian: {_event_time(data)}",
    ]
    dashboard = _dashboard_line()
    if dashboard:
        lines.extend(["", dashboard])
    return _send_message("\n".join(lines))


def notify_ai_recovery(data: Mapping[str, Any]) -> TelegramDeliveryResult:
    if not settings.telegram_notify_recovery:
        return TelegramDeliveryResult(
            "disabled",
            "Recovery notifications are disabled",
        )
    lines = [
        "[RECOVERY] THIẾT BỊ ĐÃ PHỤC HỒI",
        "",
        f"Thiết bị: {data.get('device_name', 'Không rõ')}",
        f"IP: {data.get('ip_address', 'Không rõ')}",
        "Trạng thái AI: Bình thường",
        f"Risk score: {float(data.get('risk_score', 0)):.1f}%",
        "",
        *_metric_lines(data),
        "",
        f"Thời gian: {_event_time(data)}",
    ]
    dashboard = _dashboard_line()
    if dashboard:
        lines.extend(["", dashboard])
    return _send_message("\n".join(lines))


def send_test_notification() -> TelegramDeliveryResult:
    local_time = datetime.now(VIETNAM_TIMEZONE).strftime(
        "%d/%m/%Y %H:%M:%S"
    )
    return _send_message(
        "\n".join(
            [
                "[TEST] TELEGRAM ĐÃ KẾT NỐI",
                "",
                "Backend TTTN M10 có thể gửi cảnh báo tới cuộc trò chuyện này.",
                f"Thời gian: {local_time}",
            ]
        )
    )
