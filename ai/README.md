# AI phân loại kịch bản mạng

Backend sử dụng Random Forest đa lớp để phân loại sáu kịch bản:

- `baseline`
- `stress_cpu`
- `high_traffic`
- `high_latency`
- `packet_loss`
- `attack_test`

Mỗi dự đoán sử dụng sáu feature theo đúng thứ tự:

1. `cpu_percent`
2. `memory_percent`
3. `traffic_in_mbps`
4. `traffic_out_mbps`
5. `latency_ms`
6. `packet_loss_percent`

Kết quả gồm trạng thái normal/abnormal, risk score, kịch bản có xác suất cao
nhất và phân bố xác suất của cả sáu kịch bản. Backend lưu kết quả vào
`ai_predictions`, tạo cảnh báo khi trạng thái AI thay đổi và có thể gửi sự kiện
qua Telegram.

## Model runtime

Artifact đang được sử dụng:

```text
ai/models/scenario_random_forest.joblib
```

Model được retrain ngày 29/07/2026 trên 3.549 record và đánh giá bằng 1.340
record kiểm thử độc lập. Kết quả external test:

- Accuracy: 91,64%
- Balanced accuracy: 91,15%
- Macro F1-score: 90,94%
- Weighted F1-score: 91,42%
- Recall phát hiện bất thường: 97,96%

Artifact yêu cầu `scikit-learn==1.9.0`. Có thể thay đường dẫn bằng biến môi
trường `AI_MODEL_PATH`.

Dataset huấn luyện, dữ liệu kiểm thử và các artifact đánh giá dung lượng lớn
không được lưu trong repository.
