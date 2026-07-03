# API Contract — Sprint 1

Base URL local: `http://localhost:8000/api/v1`

## Tạo thiết bị

`POST /devices`

```json
{
  "name": "Core Router",
  "ip_address": "192.168.1.1",
  "location": "Phòng Lab",
  "status": "unknown"
}
```

## Gửi metrics

`POST /metrics`

```json
{
  "device_id": 1,
  "latency_ms": 12.5,
  "packet_loss_percent": 0,
  "cpu_percent": null,
  "memory_percent": null,
  "bandwidth_mbps": null
}
```

Quy ước:

- Đơn vị latency: millisecond.
- Packet loss, CPU, memory: phần trăm từ 0 đến 100.
- Bandwidth: Mbps.
- Thời gian do Backend ghi theo UTC.
- Gửi metric với packet loss 100% sẽ chuyển thiết bị sang `offline`; các giá trị khác chuyển sang `online`.

## Tạo cảnh báo

`POST /alerts`

```json
{
  "device_id": 1,
  "level": "warning",
  "message": "Latency vượt ngưỡng 100 ms"
}
```

Các mức cảnh báo hợp lệ: `info`, `warning`, `critical`.
