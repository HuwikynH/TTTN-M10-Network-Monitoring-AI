export default function ErrorBanner({ message, onRetry, compact = false }) {
  return <div className={`error-banner${compact ? " error-banner--compact" : ""}`} role="alert"><div><strong>Không thể cập nhật dữ liệu</strong><p>{message || "Đã có lỗi xảy ra."}</p></div>{onRetry && <button className="button button--secondary" type="button" onClick={onRetry}>Thử lại</button>}</div>;
}
