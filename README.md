# TTTN M10 — Network Monitoring AI

Hệ thống giám sát thiết bị mạng, thu thập chỉ số vận hành, hiển thị dashboard và hỗ trợ phát hiện bất thường bằng AI.

## Thành viên và phạm vi phụ trách

| Thành viên | Vai trò chính | Phạm vi |
|---|---|---|
| Nguyễn Hữu Huynh | Leader, Backend, Database | Kiến trúc, API, tích hợp, báo cáo |
| Đinh Hoàng Trọng Khôi | Frontend | Dashboard, Devices, Alerts, biểu đồ |
| Trần Nguyễn Minh Trí | Collector, AI | Thu thập metrics, dataset, mô hình bất thường |

## Kiến trúc hệ thống

```text
Thiết bị EVE-NG ──SNMP/ICMP──> CollectorH ──HTTP──> FastAPI
                                                        │
                                      Random Forest predict_proba
                                                        │
                                  SQLite/PostgreSQL + AI prediction + alert
                                                        │
                                      React Dashboard + Telegram Bot
```

## Cấu trúc repository

```text
backend/      FastAPI, database, REST API
frontend/     React + Vite dashboard
collector/    Thu thập CPU, RAM, traffic, latency và packet loss
ai/           Model Random Forest và tài liệu AI
dataset/      Dữ liệu sinh ra hoặc dữ liệu tham khảo
docs/         Kiến trúc, hợp đồng API, kế hoạch Sprint
report/       Tư liệu và ảnh cho BCĐK
```

## Chạy nhanh Backend

Yêu cầu Python 3.11 trở lên.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Mở:

- API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Chạy Frontend

Yêu cầu Node.js 20 trở lên.

```powershell
cd frontend
npm install
npm run dev
```

Frontend mặc định chạy tại http://localhost:5173.

## Chạy kiểm thử

Sau khi đã cài dependencies Backend:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest -q
```

## Chạy bằng Docker

```powershell
docker compose up --build
```

Docker Compose khởi động PostgreSQL và Backend. Frontend vẫn có thể chạy riêng bằng `npm run dev` trong giai đoạn phát triển.

Mỗi thành phần có file cấu hình mẫu riêng: `backend/.env.example`,
`frontend/.env.example` và `collector/.env.example`. Chỉ sao chép thành `.env`
khi cần đổi cấu hình mặc định; không commit file `.env` thật lên GitHub.

## AI và cảnh báo Telegram

Backend tải model tại `ai/models/scenario_random_forest.joblib`. Với mỗi metric
đủ sáu feature, backend lưu dự đoán gồm trạng thái, risk score, top scenario và
xác suất của sáu kịch bản.

Telegram gửi thông báo khi thiết bị chuyển sang bất thường, đổi top scenario,
tăng từ warning lên critical hoặc phục hồi về bình thường. Token và chat ID chỉ
được lưu trong `backend/.env`. Xem hướng dẫn tại
[backend/TELEGRAM_SETUP.md](backend/TELEGRAM_SETUP.md).

## API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/health` | Kiểm tra dịch vụ |
| GET/POST | `/api/v1/devices` | Danh sách/tạo thiết bị |
| GET/PUT/DELETE | `/api/v1/devices/{id}` | Chi tiết/cập nhật/xóa thiết bị |
| GET/POST | `/api/v1/metrics` | Đọc/gửi metrics |
| GET/POST | `/api/v1/alerts` | Đọc/tạo cảnh báo |
| PATCH | `/api/v1/alerts/{id}` | Xác nhận/giải quyết cảnh báo |
| GET | `/api/v1/dashboard/summary` | Thống kê tổng quan Dashboard |
| GET | `/api/v1/ai/status` | Trạng thái model AI |
| GET | `/api/v1/ai-predictions` | Danh sách dự đoán AI |
| GET | `/api/v1/notifications/telegram/status` | Trạng thái Telegram |
| POST | `/api/v1/notifications/telegram/test` | Gửi thông báo Telegram thử |

Chi tiết request/response nằm trong Swagger và [docs/API_CONTRACT.md](docs/API_CONTRACT.md).

## Quy trình Git

Không commit trực tiếp vào `main`. Mỗi thành viên tạo branch riêng:

```text
feature/backend-<task>
feature/frontend-<task>
feature/collector-<task>
feature/ai-<task>
```

Sau khi hoàn thành: push branch, tạo Pull Request vào `develop`, review rồi mới merge.

## Kết quả model hiện tại

Model được retrain ngày 29/07/2026 và đánh giá trên 1.340 record kiểm thử độc
lập: Accuracy 91,64%, Balanced Accuracy 91,15% và Macro F1-score 90,94%.
