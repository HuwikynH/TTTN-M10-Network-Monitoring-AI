import { useEffect } from "react";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  busy = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={busy ? undefined : onCancel}>
      <div
        className="modal modal--small"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <p className="eyebrow">Xác nhận thao tác</p>
            <h2 id="confirm-dialog-title">{title}</h2>
          </div>
        </div>
        <p className="modal__message" id="confirm-dialog-message">{message}</p>
        <div className="form-actions">
          <button className="button button--secondary" type="button" onClick={onCancel} disabled={busy}>
            Hủy
          </button>
          <button className="button button--danger" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? "Đang xóa..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
