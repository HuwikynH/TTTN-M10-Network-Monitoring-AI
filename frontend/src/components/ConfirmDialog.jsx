import Modal from "./Modal";

export default function ConfirmDialog({ open, title, description, confirmLabel = "Xác nhận", busy = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <Modal title={title} onClose={onCancel} closeDisabled={busy}>
      <div className="confirm-dialog">
        <p>{description}</p>
        <div className="modal-actions">
          <button className="button button--secondary" type="button" onClick={onCancel} disabled={busy}>Hủy</button>
          <button className="button button--danger confirm-dialog__confirm" type="button" onClick={onConfirm} disabled={busy}>{busy ? "Đang xử lý…" : confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}
