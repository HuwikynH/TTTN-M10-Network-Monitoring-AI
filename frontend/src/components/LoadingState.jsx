export default function LoadingState({ label = "Đang tải dữ liệu…", fullPage = false }) {
  return <div className={`loading-state${fullPage ? " loading-state--full" : ""}`} role="status"><span className="spinner" aria-hidden="true" /><span>{label}</span></div>;
}
