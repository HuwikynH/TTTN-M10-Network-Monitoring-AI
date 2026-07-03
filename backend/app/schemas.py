from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    ip_address: str = Field(min_length=3, max_length=45)
    location: str | None = Field(default=None, max_length=150)
    status: str = Field(default="unknown", pattern="^(online|offline|unknown)$")


class DeviceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    ip_address: str | None = Field(default=None, min_length=3, max_length=45)
    location: str | None = Field(default=None, max_length=150)
    status: str | None = Field(default=None, pattern="^(online|offline|unknown)$")


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
    level: str = Field(default="warning", pattern="^(info|warning|critical)$")
    message: str = Field(min_length=1, max_length=1000)


class AlertRead(ORMModel):
    id: int
    device_id: int
    level: str
    message: str
    status: str
    created_at: datetime
