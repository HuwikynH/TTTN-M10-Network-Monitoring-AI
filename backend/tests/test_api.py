from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

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


def test_metric_alert_and_dashboard_flow(client: TestClient) -> None:
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
    assert len(alerts) == 3
    assert any(alert["level"] == "critical" for alert in alerts)

    acknowledged = client.patch(
        f"/api/v1/alerts/{alerts[0]['id']}", json={"status": "acknowledged"}
    )
    assert acknowledged.status_code == 200
    assert acknowledged.json()["status"] == "acknowledged"

    summary = client.get("/api/v1/dashboard/summary").json()
    assert summary["total_devices"] == 1
    assert summary["offline_devices"] == 1
    assert summary["total_metrics"] == 1
    assert summary["open_alerts"] == 2
    assert summary["critical_alerts"] in (0, 1)


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

    assert client.delete(f"/api/v1/metrics/{metric['id']}").status_code == 204
    assert client.delete(f"/api/v1/alerts/{alert['id']}").status_code == 204
    assert client.get(f"/api/v1/metrics/{metric['id']}").status_code == 404
    assert client.get(f"/api/v1/alerts/{alert['id']}").status_code == 404
