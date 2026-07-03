# TTTN M10 — Network Monitoring AI

Hệ thống giám sát thiết bị mạng, thu thập chỉ số vận hành, hiển thị dashboard và hỗ trợ phát hiện bất thường bằng AI.

## Thành viên và phạm vi phụ trách

| Thành viên | Vai trò chính | Phạm vi |
|---|---|---|
| Nguyễn Hữu Huynh | Leader, Backend, Database | Kiến trúc, API, tích hợp, báo cáo |
| Đinh Hoàng Trọng Khôi | Frontend | Dashboard, Devices, Alerts, biểu đồ |
| Trần Nguyễn Minh Trí | Collector, AI | Thu thập metrics, dataset, mô hình bất thường |

## Kiến trúc Sprint 1

```text
Collector ──HTTP──> FastAPI ──SQLAlchemy──> SQLite/PostgreSQL
                       │
React Dashboard ──HTTP─┘
                       │
                  AI service (Sprint 2)
```

## Cấu trúc repository

```text
backend/      FastAPI, database, REST API
frontend/     React + Vite dashboard
collector/    Chương trình thu thập latency/packet loss
ai/           Mã nguồn và tài liệu mô hình AI
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
Copy-Item .env.example .env
docker compose up --build
```

Docker Compose khởi động PostgreSQL và Backend. Frontend vẫn có thể chạy riêng bằng `npm run dev` trong giai đoạn phát triển.

## API Sprint 1

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/health` | Kiểm tra dịch vụ |
| GET/POST | `/api/v1/devices` | Danh sách/tạo thiết bị |
| GET/PUT/DELETE | `/api/v1/devices/{id}` | Chi tiết/cập nhật/xóa thiết bị |
| GET/POST | `/api/v1/metrics` | Đọc/gửi metrics |
| GET/POST | `/api/v1/alerts` | Đọc/tạo cảnh báo |

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

## Mục tiêu BCĐK1 (13–14/07/2026)

- Backend và database chạy được.
- CRUD thiết bị hoạt động trên Swagger.
- Frontend hiển thị danh sách thiết bị.
- Collector gửi được latency/packet loss.
- Có sơ đồ kiến trúc, ảnh Swagger, database và dashboard cho báo cáo.
