import os

os.environ["DATABASE_URL"] = "sqlite:///./test_network_monitoring.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_device_and_metric_flow() -> None:
    with TestClient(app) as client:
        device_response = client.post(
            "/api/v1/devices",
            json={"name": "Core Router", "ip_address": "192.0.2.10", "location": "Lab"},
        )
        assert device_response.status_code in (201, 409)

        devices = client.get("/api/v1/devices").json()
        device = next(item for item in devices if item["ip_address"] == "192.0.2.10")
        metric_response = client.post(
            "/api/v1/metrics",
            json={"device_id": device["id"], "latency_ms": 12.5, "packet_loss_percent": 0},
        )
        assert metric_response.status_code == 201
        assert metric_response.json()["device_id"] == device["id"]
