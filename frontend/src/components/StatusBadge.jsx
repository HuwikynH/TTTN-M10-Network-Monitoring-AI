const STATUS_LABELS = {
  online: "Online",
  offline: "Offline",
  unknown: "Chưa xác định",
  open: "Đang mở",
};

export default function StatusBadge({ status = "unknown" }) {
  const normalizedStatus = String(status).toLowerCase();

  return (
    <span className={`badge badge--${normalizedStatus}`}>
      <span className="badge__dot" aria-hidden="true" />
      {STATUS_LABELS[normalizedStatus] || status}
    </span>
  );
}
