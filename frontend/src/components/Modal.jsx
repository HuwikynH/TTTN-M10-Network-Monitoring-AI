import { useEffect, useRef } from "react";

export default function Modal({ title, children, onClose, closeDisabled = false }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event) => { if (event.key === "Escape" && !closeDisabledRef.current) onCloseRef.current(); };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !closeDisabled && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><h2 id="modal-title">{title}</h2><button ref={closeRef} className="icon-button" type="button" aria-label="Đóng hộp thoại" onClick={onClose} disabled={closeDisabled}>×</button></div><div className="modal-body">{children}</div></section></div>;
}
