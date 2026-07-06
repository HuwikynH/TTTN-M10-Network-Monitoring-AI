from datetime import datetime
from ipaddress import ip_address
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

DeviceStatus = Literal["online", "offline", "unknown"]
AlertLevel = Literal["info", "warning", "critical"]
AlertStatus = Literal["open", "acknowledged", "resolved"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    ip_address: str = Field(min_length=3, max_length=45)
    location: str | None = Field(default=None, max_length=150)
    status: DeviceStatus = "unknown"

    @field_validator("ip_address")
    @classmethod
    def validate_ip_address(cls, value: str) -> str:
        try:
            return str(ip_address(value))
        except ValueError as exc:
            raise ValueError("Invalid IPv4 or IPv6 address") from exc


class DeviceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    ip_address: str | None = Field(default=None, min_length=3, max_length=45)
    location: str | None = Field(default=None, max_length=150)
    status: DeviceStatus | None = None

    @field_validator("ip_address")
    @classmethod
    def validate_ip_address(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            return str(ip_address(value))
        except ValueError as exc:
            raise ValueError("Invalid IPv4 or IPv6 address") from exc


class DeviceRead(ORMModel):
    id: int
    name: str
    ip_address: str
    location: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class MetricCreate(BaseModel):
    device_id: int
    latency_ms: float | None = Field(default=None, ge=0)
    packet_loss_percent: float | None = Field(default=None, ge=0, le=100)
    cpu_percent: float | None = Field(default=None, ge=0, le=100)
    memory_percent: float | None = Field(default=None, ge=0, le=100)
    bandwidth_mbps: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def require_at_least_one_measurement(self) -> "MetricCreate":
        measurements = (
            self.latency_ms,
            self.packet_loss_percent,
            self.cpu_percent,
            self.memory_percent,
            self.bandwidth_mbps,
        )
        if all(value is None for value in measurements):
            raise ValueError("At least one metric value is required")
        return self


class MetricRead(ORMModel):
    id: int
    device_id: int
    latency_ms: float | None
    packet_loss_percent: float | None
    cpu_percent: float | None
    memory_percent: float | None
    bandwidth_mbps: float | None
    collected_at: datetime


class AlertCreate(BaseModel):
    device_id: int
    level: AlertLevel = "warning"
    message: str = Field(min_length=1, max_length=1000)


class AlertUpdate(BaseModel):
    status: AlertStatus


class AlertRead(ORMModel):
    id: int
    device_id: int
    level: str
    message: str
    status: str
    created_at: datetime


class DashboardSummary(BaseModel):
    total_devices: int
    online_devices: int
    offline_devices: int
    unknown_devices: int
    total_metrics: int
    open_alerts: int
    critical_alerts: int
    last_metric_at: datetime | None
