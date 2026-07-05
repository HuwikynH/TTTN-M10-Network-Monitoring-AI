export default function Loading({ message = "Đang tải dữ liệu..." }) {
  return (
    <div className="state-message" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
