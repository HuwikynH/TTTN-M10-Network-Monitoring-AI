# API Contract — Sprint 1

Base URL local: `http://localhost:8000/api/v1`

Swagger đầy đủ: `http://localhost:8000/docs`

## Trạng thái hệ thống

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/health` | Backend đang hoạt động |
| GET | `/ready` | Backend kết nối được database |

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

Các API thiết bị:

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/devices` | Danh sách; hỗ trợ `status`, `search`, `skip`, `limit` |
| POST | `/devices` | Tạo thiết bị |
| GET | `/devices/{id}` | Chi tiết thiết bị |
| PUT | `/devices/{id}` | Cập nhật thiết bị |
| DELETE | `/devices/{id}` | Xóa thiết bị và dữ liệu liên quan |
| GET | `/devices/{id}/metrics` | Lịch sử metrics của thiết bị |

## Gửi metrics

`POST /metrics`

```json
{
  "device_id": 1,
  "latency_ms": 12.5,
  "packet_loss_percent": 0,
  "cpu_percent": null,
  "memory_percent": null,
  "traffic_in_mbps": null,
  "traffic_out_mbps": null,
  "bandwidth_mbps": null
}
```

Quy ước:

- Đơn vị latency: millisecond.
- Packet loss, CPU, memory: phần trăm từ 0 đến 100.
- Traffic inbound/outbound: Mbps; cả hai trường này cần có để chạy model AI.
- Bandwidth: Mbps.
- Thời gian do Backend ghi theo UTC.
- Gửi metric với packet loss 100% sẽ chuyển thiết bị sang `offline`; các giá trị khác chuyển sang `online`.
- Request phải có ít nhất một giá trị đo ngoài `device_id`.

Các API metrics:

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/metrics` | Danh sách; hỗ trợ `device_id`, `skip`, `limit` |
| POST | `/metrics` | Collector gửi một mẫu đo |
| GET | `/metrics/{id}` | Chi tiết mẫu đo |
| DELETE | `/metrics/{id}` | Xóa mẫu đo |

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

Trạng thái cảnh báo: `open`, `acknowledged`, `resolved`.

```http
PATCH /alerts/{id}
```

```json
{
  "status": "acknowledged"
}
```

Backend không tự suy diễn cảnh báo từ các ngưỡng CPU, RAM, traffic, latency hoặc
packet loss cố định. Endpoint `POST /alerts` vẫn được giữ cho cảnh báo do người
vận hành hoặc hệ thống bên ngoài tạo.
Trạng thái kết nối thiết bị vẫn được cập nhật từ metric và thời gian nhận dữ liệu.

## AI Prediction

Khi metric chứa đủ sáu feature, Backend tự chạy model và lưu kết quả theo
`device_id` và `metric_id`:

```text
cpu_percent
memory_percent
traffic_in_mbps
traffic_out_mbps
latency_ms
packet_loss_percent
```

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/ai/status` | Trạng thái model và feature contract |
| GET | `/ai-predictions?device_id={id}` | Lịch sử dự đoán của thiết bị |

Frontend đọc prediction mới nhất để hiển thị status, risk score, top scenario và
xác suất sáu scenario. Khi prediction chuyển từ `normal` sang `abnormal`, hoặc
scenario bất thường thay đổi, Backend lưu ngay một alert:

- `risk_score < 90`: `warning`.
- `risk_score >= 90`: `critical`.
- Các lần quét liên tiếp vẫn cùng trạng thái và scenario không tạo alert trùng.
- Sau khi prediction trở lại `normal`, lần bất thường tiếp theo được xem là một
  sự kiện mới và được lưu lại.

## Dashboard

`GET /dashboard/summary`

```json
{
  "total_devices": 3,
  "online_devices": 2,
  "offline_devices": 1,
  "unknown_devices": 0,
  "total_metrics": 120,
  "open_alerts": 4,
  "critical_alerts": 1,
  "last_metric_at": "2026-07-03T10:00:00Z"
}
```
