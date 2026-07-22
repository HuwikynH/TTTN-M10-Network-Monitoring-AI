import { useEffect, useRef, useState } from "react";
import StatusBadge from "./StatusBadge";

function valuesFromDevice(device) {
  return { name: device?.name || "", ip_address: device?.ip_address || "", location: device?.location || "" };
}

export default function DeviceForm({ device, isOpen = true, onSubmit, onCancel, onSubmittingChange }) {
  const deviceId = device?.id ?? "new";
  const [values, setValues] = useState(() => valuesFromDevice(device));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    setValues(valuesFromDevice(device));
    setErrors({});
    setSubmitError("");
  }, [deviceId, isOpen]);
  const change = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const payload = { name: values.name.trim(), ip_address: values.ip_address.trim(), location: values.location.trim() || null };
    const nextErrors = {};
    if (!payload.name) nextErrors.name = "Vui lòng nhập tên thiết bị.";
    if (!payload.ip_address) nextErrors.ip_address = "Vui lòng nhập địa chỉ IPv4 hoặc IPv6.";
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    submittingRef.current = true;
    setSubmitting(true);
    onSubmittingChange?.(true);
    setSubmitError("");
    try { await onSubmit(device ? payload : { ...payload, status: "unknown" }); }
    catch (error) { setSubmitError(error.message); }
    finally { submittingRef.current = false; setSubmitting(false); onSubmittingChange?.(false); }
  };
  return (
    <form className="device-form" onSubmit={submit} noValidate>
      {submitError && <div className="form-error" role="alert">{submitError}</div>}
      <div className="field"><label htmlFor="device-name">Tên thiết bị <span aria-hidden="true">*</span></label><input id="device-name" name="name" value={values.name} onChange={change} maxLength="100" autoComplete="off" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "device-name-error" : undefined} />{errors.name && <span className="field-error" id="device-name-error">{errors.name}</span>}</div>
      <div className="field"><label htmlFor="device-ip">Địa chỉ IP <span aria-hidden="true">*</span></label><input id="device-ip" name="ip_address" value={values.ip_address} onChange={change} maxLength="45" placeholder="192.168.1.1 hoặc 2001:db8::1" spellCheck="false" aria-invalid={Boolean(errors.ip_address)} aria-describedby={errors.ip_address ? "device-ip-error" : "device-ip-hint"} />{errors.ip_address ? <span className="field-error" id="device-ip-error">{errors.ip_address}</span> : <span className="field-hint" id="device-ip-hint">Backend xác thực đầy đủ địa chỉ IPv4 và IPv6.</span>}</div>
      <div className="field"><label htmlFor="device-location">Vị trí</label><input id="device-location" name="location" value={values.location} onChange={change} maxLength="150" placeholder="Ví dụ: Phòng máy chủ" /></div>
      {device ? <div className="field"><span className="field-label">Trạng thái do hệ thống xác định</span><StatusBadge status={device.status} /><span className="field-hint">Trạng thái được cập nhật tự động từ metric của Collector.</span></div> : <div className="form-note">Thiết bị mới bắt đầu ở trạng thái “Chưa xác định” cho đến khi nhận metric đầu tiên.</div>}
      <div className="modal-actions"><button className="button button--secondary" type="button" onClick={onCancel} disabled={submitting}>Hủy</button><button className="button button--primary" type="submit" disabled={submitting}>{submitting ? "Đang lưu…" : device ? "Lưu thay đổi" : "Thêm thiết bị"}</button></div>
    </form>
  );
}
