from types import SimpleNamespace

import httpx

from app import telegram_service


def telegram_settings(**overrides):
    values = {
        "telegram_enabled": True,
        "telegram_bot_token": "test-token",
        "telegram_chat_id": "123456",
        "telegram_timeout_seconds": 1.0,
        "telegram_notify_recovery": True,
        "telegram_dashboard_url": "",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_alert_message_is_sent_with_device_and_metrics(monkeypatch):
    captured = {}

    class Response:
        status_code = 200

        @staticmethod
        def json():
            return {"ok": True, "result": {"message_id": 1}}

    def fake_post(url, *, json, timeout):
        captured.update({"url": url, "json": json, "timeout": timeout})
        return Response()

    monkeypatch.setattr(telegram_service, "settings", telegram_settings())
    monkeypatch.setattr(telegram_service.httpx, "post", fake_post)

    result = telegram_service.notify_ai_alert(
        {
            "device_name": "DMZ-SERVER",
            "ip_address": "10.20.20.10",
            "level": "critical",
            "risk_score": 94,
            "top_scenario": "packet_loss",
            "top_scenario_confidence": 88,
            "cpu_percent": 12,
            "memory_percent": 31,
            "traffic_in_mbps": 5,
            "traffic_out_mbps": 2,
            "latency_ms": 20,
            "packet_loss_percent": 50,
        }
    )

    assert result.sent is True
    assert captured["json"]["chat_id"] == "123456"
    assert "DMZ-SERVER" in captured["json"]["text"]
    assert "M\u1ea5t g\u00f3i" in captured["json"]["text"]
    assert "Packet loss: 50.00%" in captured["json"]["text"]


def test_network_error_is_contained(monkeypatch):
    request = httpx.Request("POST", "https://example.invalid")

    def fail_post(*_args, **_kwargs):
        raise httpx.ConnectError("offline", request=request)

    monkeypatch.setattr(telegram_service, "settings", telegram_settings())
    monkeypatch.setattr(telegram_service.httpx, "post", fail_post)

    result = telegram_service.send_test_notification()

    assert result.sent is False
    assert result.status == "delivery_failed"
