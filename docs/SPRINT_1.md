# Sprint 1 — 03/07 đến 12/07/2026

## Definition of Done

- Code được push trên branch cá nhân và tạo Pull Request.
- Có cách chạy và cách kiểm thử rõ ràng.
- API thay đổi phải cập nhật Swagger/API contract.
- Tính năng quan trọng có ảnh lưu cho BCĐK1.

## Huynh — Backend/Leader

- [x] Khởi tạo repository và kiến trúc.
- [x] Tạo API Device, Metric, Alert cơ bản.
- [x] Cấu hình SQLite/PostgreSQL.
- [ ] Vẽ ERD và deployment diagram.
- [ ] Chuẩn bị dàn ý BCĐK1.
- [ ] Review và tích hợp Pull Request.

## Khôi — Frontend

- [x] Có dashboard skeleton và kết nối API đọc dữ liệu.
- [ ] Hoàn thiện form thêm/sửa/xóa thiết bị.
- [ ] Thêm biểu đồ latency và packet loss.
- [ ] Hoàn thiện trang Alerts và responsive.

## Trí — Collector/AI

- [x] Có collector ping mẫu.
- [ ] Kiểm thử với nhiều host và xử lý timeout.
- [ ] Sinh CSV metrics dùng làm dataset.
- [ ] Xây rule cảnh báo ban đầu.
- [ ] Viết tài liệu lựa chọn đặc trưng AI.

## Demo BCĐK1

1. Tạo thiết bị trên Swagger.
2. Chạy Collector gửi latency/packet loss.
3. Mở Dashboard thấy trạng thái thiết bị.
4. Tạo cảnh báo và kiểm tra API Alerts.
5. Chụp ảnh từng bước vào `report/images`.
