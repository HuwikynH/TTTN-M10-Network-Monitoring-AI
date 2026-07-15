from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings
from app.database import get_db
from app.services import build_metric_alerts

router = APIRouter(prefix="/api/v1")


def mark_stale_devices_offline(db: Session) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.device_stale_seconds)
    latest_metric_subquery = (
        select(
            models.Metric.device_id,
            func.max(models.Metric.collected_at).label("last_metric_at"),
        )
        .group_by(models.Metric.device_id)
        .subquery()
    )
    query = (
        select(models.Device)
        .join(latest_metric_subquery, latest_metric_subquery.c.device_id == models.Device.id)
        .where(
            models.Device.status == "online",
            latest_metric_subquery.c.last_metric_at < cutoff,
        )
    )
    stale_devices = list(db.scalars(query))
    if not stale_devices:
        return
    for device in stale_devices:
        device.status = "offline"
    db.commit()


@router.get("/devices", response_model=list[schemas.DeviceRead], tags=["Devices"])
def list_devices(db: Session = Depends(get_db)) -> list[models.Device]:
    return list(db.scalars(select(models.Device).order_by(models.Device.id)))


@router.post(
    "/devices", response_model=schemas.DeviceRead, status_code=status.HTTP_201_CREATED, tags=["Devices"]
)
def create_device(payload: schemas.DeviceCreate, db: Session = Depends(get_db)) -> models.Device:
    device = models.Device(**payload.model_dump())
    db.add(device)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="IP address already exists") from exc
    db.refresh(device)
    return device


def get_device_or_404(device_id: int, db: Session) -> models.Device:
    device = db.get(models.Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


def resolve_metric_device(payload: schemas.MetricCreate, db: Session) -> models.Device:
    if payload.device_id is not None:
        return get_device_or_404(payload.device_id, db)

    assert payload.ip_address is not None
    query = select(models.Device).where(models.Device.ip_address == payload.ip_address)
    device = db.scalar(query)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.get("/devices/{device_id}", response_model=schemas.DeviceRead, tags=["Devices"])
def get_device(device_id: int, db: Session = Depends(get_db)) -> models.Device:
    mark_stale_devices_offline(db)
    return get_device_or_404(device_id, db)


@router.put("/devices/{device_id}", response_model=schemas.DeviceRead, tags=["Devices"])
def update_device(
    device_id: int, payload: schemas.DeviceUpdate, db: Session = Depends(get_db)
) -> models.Device:
    device = get_device_or_404(device_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(device, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="IP address already exists") from exc
    db.refresh(device)
    return device


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Devices"])
def delete_device(device_id: int, db: Session = Depends(get_db)) -> None:
    device = get_device_or_404(device_id, db)
    db.delete(device)
    db.commit()


@router.get(
    "/devices/{device_id}/metrics", response_model=list[schemas.MetricRead], tags=["Devices", "Metrics"]
)
def list_device_metrics(
    device_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[models.Metric]:
    get_device_or_404(device_id, db)
    query = (
        select(models.Metric)
        .where(models.Metric.device_id == device_id)
        .order_by(models.Metric.collected_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(query))


@router.get("/metrics", response_model=list[schemas.MetricRead], tags=["Metrics"])
def list_metrics(
    device_id: int | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[models.Metric]:
    query = select(models.Metric)
    if device_id is not None:
        query = query.where(models.Metric.device_id == device_id)
    query = query.order_by(models.Metric.collected_at.desc()).offset(skip).limit(limit)
    return list(db.scalars(query))


def get_metric_or_404(metric_id: int, db: Session) -> models.Metric:
    metric = db.get(models.Metric, metric_id)
    if metric is None:
        raise HTTPException(status_code=404, detail="Metric not found")
    return metric


@router.get("/metrics/{metric_id}", response_model=schemas.MetricRead, tags=["Metrics"])
def get_metric(metric_id: int, db: Session = Depends(get_db)) -> models.Metric:
    return get_metric_or_404(metric_id, db)


@router.post(
    "/metrics", response_model=schemas.MetricRead, status_code=status.HTTP_201_CREATED, tags=["Metrics"]
)
def create_metric(payload: schemas.MetricCreate, db: Session = Depends(get_db)) -> models.Metric:
    device = get_device_or_404(payload.device_id, db)
    metric = models.Metric(**payload.model_dump())
    if payload.packet_loss_percent == 100:
        device.status = "offline"
    else:
        device.status = "online"
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric


@router.delete("/metrics/{metric_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Metrics"])
def delete_metric(metric_id: int, db: Session = Depends(get_db)) -> None:
    metric = get_metric_or_404(metric_id, db)
    db.delete(metric)
    db.commit()


@router.get("/alerts", response_model=list[schemas.AlertRead], tags=["Alerts"])
def list_alerts(
    device_id: int | None = None,
    status_value: schemas.AlertStatus | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[models.Alert]:
    query = select(models.Alert)
    if device_id is not None:
        query = query.where(models.Alert.device_id == device_id)
    if status_value is not None:
        query = query.where(models.Alert.status == status_value)
    query = query.order_by(models.Alert.created_at.desc()).offset(skip).limit(limit)
    return list(db.scalars(query))


def get_alert_or_404(alert_id: int, db: Session) -> models.Alert:
    alert = db.get(models.Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.get("/alerts/{alert_id}", response_model=schemas.AlertRead, tags=["Alerts"])
def get_alert(alert_id: int, db: Session = Depends(get_db)) -> models.Alert:
    return get_alert_or_404(alert_id, db)


@router.post(
    "/alerts", response_model=schemas.AlertRead, status_code=status.HTTP_201_CREATED, tags=["Alerts"]
)
def create_alert(payload: schemas.AlertCreate, db: Session = Depends(get_db)) -> models.Alert:
    get_device_or_404(payload.device_id, db)
    alert = models.Alert(**payload.model_dump())
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert
