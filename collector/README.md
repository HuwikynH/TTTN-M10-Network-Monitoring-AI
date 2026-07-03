# Collector

Collector Sprint 1 đo latency và packet loss bằng lệnh `ping`, sau đó gửi dữ liệu vào `POST /api/v1/metrics`.

Trước khi chạy, tạo thiết bị trong Swagger và lấy `id`:

```powershell
cd collector
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DEVICE_ID="1"
$env:TARGET_HOST="8.8.8.8"
python collector.py
```

Sprint tiếp theo sẽ bổ sung CPU, RAM, bandwidth qua SNMP hoặc agent.
