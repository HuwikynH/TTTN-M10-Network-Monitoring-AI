import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite://"

from app.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite://"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@event.listens_for(engine, "connect")
def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def reset_database() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


def create_device(client: TestClient, ip_address: str = "192.0.2.10") -> dict:
    response = client.post(
        "/api/v1/devices",
        json={"name": "Core Router", "ip_address": ip_address, "location": "Lab"},
    )
    assert response.status_code == 201
    return response.json()


def test_health_and_readiness(client: TestClient) -> None:
    assert client.get("/health").json()["status"] == "healthy"
    readiness = client.get("/ready")
    assert readiness.status_code == 200
    assert readiness.json()["database"] == "connected"


def test_device_crud_and_validation(client: TestClient) -> None:
    device = create_device(client)
    assert device["status"] == "unknown"

    duplicate = client.post(
        "/api/v1/devices", json={"name": "Duplicate", "ip_address": "192.0.2.10"}
    )
    assert duplicate.status_code == 409

    invalid = client.post(
        "/api/v1/devices", json={"name": "Bad Router", "ip_address": "not-an-ip"}
    )
    assert invalid.status_code == 422

    updated = client.put(
        f"/api/v1/devices/{device['id']}", json={"name": "Updated Router", "status": "online"}
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Router"

    deleted = client.delete(f"/api/v1/devices/{device['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/devices/{device['id']}").status_code == 404


def test_metric_status_and_dashboard_flow(client: TestClient) -> None:
    device = create_device(client)
    metric_response = client.post(
        "/api/v1/metrics",
        json={
            "device_id": device["id"],
            "latency_ms": 150,
            "packet_loss_percent": 100,
            "cpu_percent": 95,
        },
    )
    assert metric_response.status_code == 201
    metric = metric_response.json()

    current_device = client.get(f"/api/v1/devices/{device['id']}").json()
    assert current_device["status"] == "offline"

    metrics = client.get(f"/api/v1/devices/{device['id']}/metrics").json()
    assert metrics[0]["id"] == metric["id"]

    alerts = client.get("/api/v1/alerts", params={"device_id": device["id"]}).json()
    assert alerts == []

    summary = client.get("/api/v1/dashboard/summary").json()
    assert summary["total_devices"] == 1
    assert summary["offline_devices"] == 1
    assert summary["total_metrics"] == 1
    assert summary["open_alerts"] == 0
    assert summary["critical_alerts"] == 0


def test_metric_requires_value_and_known_device(client: TestClient) -> None:
    empty = client.post("/api/v1/metrics", json={"device_id": 1})
    assert empty.status_code == 422

    unknown = client.post(
        "/api/v1/metrics", json={"device_id": 999, "latency_ms": 10}
    )
    assert unknown.status_code == 404

    missing_identity = client.post("/api/v1/metrics", json={"latency_ms": 10})
    assert missing_identity.status_code == 422

    duplicate_identity = client.post(
        "/api/v1/metrics",
        json={"device_id": 1, "ip_address": "192.0.2.10", "latency_ms": 10},
    )
    assert duplicate_identity.status_code == 422


def test_metric_can_target_device_by_ip_address(client: TestClient) -> None:
    device = create_device(client, ip_address="192.0.2.20")

    metric_response = client.post(
        "/api/v1/metrics",
        json={"ip_address": "192.0.2.20", "latency_ms": 15, "packet_loss_percent": 0},
    )
    assert metric_response.status_code == 201
    metric = metric_response.json()
    assert metric["device_id"] == device["id"]

    device_after_metric = client.get(f"/api/v1/devices/{device['id']}").json()
    assert device_after_metric["status"] == "online"


def test_complete_metric_creates_ai_prediction(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    device = create_device(client)
    expected = {
        "status": "abnormal",
        "risk_score": 87.0,
        "top_scenario": "high_traffic",
        "top_scenario_confidence": 62.0,
        "scenario_probabilities": {
            "baseline": 13.0,
            "stress_cpu": 8.0,
            "high_traffic": 62.0,
            "high_latency": 12.0,
            "packet_loss": 3.0,
            "attack_test": 2.0,
        },
    }
    monkeypatch.setattr("app.api.predict_metric", lambda _metric: expected)

    metric_response = client.post(
        "/api/v1/metrics",
        json={
            "device_id": device["id"],
            "cpu_percent": 44,
            "memory_percent": 63,
            "traffic_in_mbps": 6590,
            "traffic_out_mbps": 2620,
            "latency_ms": 2,
            "packet_loss_percent": 0,
            "bandwidth_mbps": 9210,
        },
    )
    assert metric_response.status_code == 201
    assert metric_response.json()["traffic_in_mbps"] == 6590

    predictions = client.get(
        "/api/v1/ai-predictions", params={"device_id": device["id"], "limit": 1}
    )
    assert predictions.status_code == 200
    prediction = predictions.json()[0]
    assert prediction["metric_id"] == metric_response.json()["id"]
    assert prediction["top_scenario"] == "high_traffic"
    assert prediction["risk_score"] == 87.0
    assert prediction["scenario_probabilities"]["high_traffic"] == 62.0

    alerts = client.get(
        "/api/v1/alerts", params={"device_id": device["id"]}
    ).json()
    assert len(alerts) == 1
    assert alerts[0]["level"] == "warning"
    assert "Risk 87.0%" in alerts[0]["message"]


def test_ai_alert_is_created_on_each_new_abnormal_event(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    device = create_device(client)
    abnormal = {
        "status": "abnormal",
        "risk_score": 94.0,
        "top_scenario": "packet_loss",
        "top_scenario_confidence": 81.0,
        "scenario_probabilities": {
            "baseline": 6.0,
            "stress_cpu": 1.0,
            "high_traffic": 4.0,
            "high_latency": 6.0,
            "packet_loss": 81.0,
            "attack_test": 2.0,
        },
    }
    normal = {
        "status": "normal",
        "risk_score": 8.0,
        "top_scenario": "baseline",
        "top_scenario_confidence": 92.0,
        "scenario_probabilities": {
            "baseline": 92.0,
            "stress_cpu": 1.0,
            "high_traffic": 2.0,
            "high_latency": 2.0,
            "packet_loss": 2.0,
            "attack_test": 1.0,
        },
    }
    predictions = iter([abnormal, abnormal, normal, abnormal])
    monkeypatch.setattr("app.api.predict_metric", lambda _metric: next(predictions))

    payload = {
        "device_id": device["id"],
        "cpu_percent": 20,
        "memory_percent": 30,
        "traffic_in_mbps": 1,
        "traffic_out_mbps": 1,
        "latency_ms": 10,
        "packet_loss_percent": 20,
    }
    for _ in range(4):
        assert client.post("/api/v1/metrics", json=payload).status_code == 201

    alerts = client.get(
        "/api/v1/alerts", params={"device_id": device["id"]}
    ).json()
    assert len(alerts) == 2
    assert all(alert["level"] == "critical" for alert in alerts)


def test_metric_and_alert_delete(client: TestClient) -> None:
    device = create_device(client)
    metric = client.post(
        "/api/v1/metrics",
        json={"device_id": device["id"], "latency_ms": 10, "packet_loss_percent": 0},
    ).json()
    alert = client.post(
        "/api/v1/alerts",
        json={"device_id": device["id"], "level": "info", "message": "Manual alert"},
    ).json()

    acknowledged = client.patch(
        f"/api/v1/alerts/{alert['id']}", json={"status": "acknowledged"}
    )
    assert acknowledged.status_code == 200
    assert acknowledged.json()["status"] == "acknowledged"

    assert client.delete(f"/api/v1/metrics/{metric['id']}").status_code == 204
    assert client.delete(f"/api/v1/alerts/{alert['id']}").status_code == 204
    assert client.get(f"/api/v1/metrics/{metric['id']}").status_code == 404
    assert client.get(f"/api/v1/alerts/{alert['id']}").status_code == 404
