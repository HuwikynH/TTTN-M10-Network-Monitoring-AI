const LABELS = {
  online: "Online", offline: "Offline", unknown: "Chưa xác định",
  open: "Đang mở", acknowledged: "Đã xác nhận", resolved: "Đã xử lý",
  live: "Đang cập nhật", refreshing: "Đang làm mới", stale: "Dữ liệu chậm",
  disconnected: "Mất kết nối", paused: "Đã tạm dừng",
  info: "Thông tin", warning: "Cảnh báo", critical: "Nghiêm trọng",
};

export default function StatusBadge({ status, label }) {
  const normalized = status || "unknown";
  return <span className={`status-badge status-badge--${normalized}`}><span className="status-badge__dot" aria-hidden="true" />{label || LABELS[normalized] || normalized}</span>;
}
