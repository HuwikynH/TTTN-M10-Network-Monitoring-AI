export function ErrorMessage({ message, onRetry, retryLabel = "Thử lại" }) {
  if (!message) return null;

  return (
    <div className="alert-box alert-box--error" role="alert">
      <span>{message}</span>
      {onRetry && <button type="button" onClick={onRetry}>{retryLabel}</button>}
    </div>
  );
}

export function EmptyState({ title, message, action, compact = false }) {
  return (
    <div className={`empty-state${title ? " empty-state--large" : ""}${compact ? " empty-state--compact" : ""}`}>
      {title && <strong>{title}</strong>}
      <span>{message}</span>
      {action}
    </div>
  );
}
