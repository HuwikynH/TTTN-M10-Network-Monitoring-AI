# AI — kế hoạch Sprint 2

Pipeline dự kiến:

1. Nhận dữ liệu metrics do Collector tạo.
2. Làm sạch và tạo đặc trưng theo cửa sổ thời gian.
3. Xây baseline rule-based để gán nhãn ban đầu.
4. Huấn luyện Logistic Regression và Random Forest.
5. So sánh precision, recall, F1-score và confusion matrix.
6. Đóng gói mô hình để Backend gọi dự đoán.

Không commit file model hoặc dataset lớn trực tiếp vào Git. Dùng release artifact hoặc kho lưu trữ riêng khi cần.
