# AI — kế hoạch Sprint 2

Pipeline dự kiến:

1. Nhận dữ liệu metrics do Collector tạo.
2. Làm sạch và tạo đặc trưng theo cửa sổ thời gian.
3. Dùng nhãn `scenario` đã ghi nhận trong từng phiên thu thập làm biến mục tiêu.
4. Huấn luyện Logistic Regression và Random Forest.
5. So sánh precision, recall, F1-score và confusion matrix.
6. Đóng gói mô hình để Backend gọi dự đoán.

Không commit file model hoặc dataset lớn trực tiếp vào Git. Dùng release artifact hoặc kho lưu trữ riêng khi cần.

## Model runtime

Backend mặc định tải:

```text
ai/models/scenario_random_forest.joblib
```

Có thể thay đổi bằng biến môi trường `AI_MODEL_PATH`. Artifact hiện tại yêu cầu
`scikit-learn==1.9.0` và dùng đúng thứ tự sáu feature được ghi trong model.
