export default function DemoDataBadge({ compact = false }) {
  return (
    <span
      className={"demo-data-badge" + (compact ? " demo-data-badge--compact" : "")}
      title="Dữ liệu mô phỏng được lưu cục bộ trên trình duyệt và không phản ánh hệ thống thật."
    >
      <span className="demo-data-badge__dot" aria-hidden="true" />
      Dữ liệu mô phỏng
    </span>
  );
}
