# Thiết lập cảnh báo Telegram

Backend chỉ gửi Telegram khi AI tạo một sự kiện mới:

- Thiết bị chuyển từ normal sang abnormal.
- Top scenario thay đổi.
- Cùng scenario nhưng risk score tăng từ warning lên critical.
- Thiết bị chuyển từ abnormal về normal nếu bật thông báo phục hồi.

Metric, AI prediction và alert được commit vào database trước khi Telegram chạy.
Lỗi mạng Telegram không hủy dữ liệu đã lưu.

## 1. Tạo bot

1. Mở Telegram và tìm tài khoản chính thức `@BotFather`.
2. Gửi `/newbot`.
3. Đặt tên và username cho bot.
4. Lưu token do BotFather cấp. Không gửi token qua chat, ảnh chụp hoặc Git.

## 2. Lấy chat ID

1. Mở cuộc trò chuyện với bot vừa tạo.
2. Nhấn Start hoặc gửi `/start`.
3. Tạm điền token vào `backend/.env`.
4. Mở URL sau trong trình duyệt, thay `<TOKEN>` bằng token thật:

```text
https://api.telegram.org/bot<TOKEN>/getUpdates
```

Tìm `message.chat.id` trong JSON trả về. Đây là `TELEGRAM_CHAT_ID`.

Không chụp hoặc chia sẻ URL vì URL chứa bot token. Sau khi thiết lập xong có thể
dùng BotFather để thu hồi token và cấp token mới nếu token đã bị lộ.

## 3. Cấu hình Backend

Mở `backend/.env` và sửa:

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=<TOKEN_DO_BOTFATHER_CAP>
TELEGRAM_CHAT_ID=<CHAT_ID>
TELEGRAM_TIMEOUT_SECONDS=5
TELEGRAM_NOTIFY_RECOVERY=true
TELEGRAM_DASHBOARD_URL=
```

`TELEGRAM_DASHBOARD_URL` là tùy chọn. Chỉ điền URL LAN hoặc URL công khai mà
điện thoại truy cập được; không dùng `127.0.0.1`.

Khởi động lại Backend sau khi sửa `.env`.

## 4. Kiểm tra trên Swagger

Mở:

```text
http://127.0.0.1:8000/docs
```

Thực hiện lần lượt:

```text
GET  /api/v1/notifications/telegram/status
POST /api/v1/notifications/telegram/test
```

Kết quả test thành công:

```json
{
  "status": "sent",
  "detail": "Telegram message sent"
}
```

Điện thoại chỉ hiện popup nếu Telegram được phép gửi notification và cuộc trò
chuyện với bot không bị tắt thông báo.

## 5. Chia sẻ cảnh báo với nhóm

Backend hiện gửi cảnh báo tới một `TELEGRAM_CHAT_ID`. Để mọi thành viên cùng
nhận cảnh báo:

1. Tạo một nhóm Telegram cho đồ án.
2. Thêm `@NetworkOCbot` vào nhóm.
3. Gửi một tin nhắn trong nhóm, ví dụ `/start`.
4. Dùng `getUpdates` như mục 2 và lấy `message.chat.id` của nhóm. Chat ID nhóm
   thường là một số âm.
5. Thay `TELEGRAM_CHAT_ID` trong `backend/.env` bằng chat ID nhóm.
6. Khởi động lại Backend và gọi endpoint gửi tin thử.

Mọi thành viên trong nhóm sẽ đọc được cảnh báo. Popup trên từng điện thoại phụ
thuộc vào cài đặt thông báo của nhóm trên thiết bị đó.

## 6. Bảo mật

- `backend/.env` đã được `.gitignore` bỏ qua.
- Chỉ `.env.example` được commit và luôn để token/chat ID trống.
- Không ghi token vào source code, README, issue, commit hoặc ảnh báo cáo.
- Nếu token bị lộ, dùng BotFather để revoke và tạo token mới.
