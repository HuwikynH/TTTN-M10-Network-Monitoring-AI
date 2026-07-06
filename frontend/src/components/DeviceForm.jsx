import { useEffect, useId, useState } from "react";
import { ErrorMessage } from "./StateFeedback";

const EMPTY_FORM = {
  name: "",
  ip_address: "",
  location: "",
  status: "unknown",
};

function validate(values) {
  const errors = {};
  const name = values.name.trim();
  const ipAddress = values.ip_address.trim();

  if (!name) errors.name = "Tên thiết bị là bắt buộc.";
  else if (name.length > 100) errors.name = "Tên thiết bị không được vượt quá 100 ký tự.";

  if (!ipAddress) errors.ip_address = "Địa chỉ IP là bắt buộc.";
  else if (ipAddress.length < 3 || ipAddress.length > 45) {
    errors.ip_address = "Địa chỉ IP phải có từ 3 đến 45 ký tự.";
  }

  if (values.location.trim().length > 150) {
    errors.location = "Vị trí không được vượt quá 150 ký tự.";
  }

  return errors;
}

export default function DeviceForm({ device, busy, submitError, onSubmit, onCancel }) {
  const formId = useId();
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setValues(
      device
        ? {
            name: device.name || "",
            ip_address: device.ip_address || "",
            location: device.location || "",
            status: device.status || "unknown",
          }
        : EMPTY_FORM,
    );
    setErrors({});
  }, [device]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate(values);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit({
      name: values.name.trim(),
      ip_address: values.ip_address.trim(),
      location: values.location.trim() || null,
      status: values.status,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <ErrorMessage message={submitError} />

      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${formId}-name`}>Tên thiết bị <strong aria-hidden="true">*</strong></label>
          <input
            autoFocus
            id={`${formId}-name`}
            name="name"
            value={values.name}
            onChange={handleChange}
            maxLength={100}
            placeholder="Ví dụ: Core Router"
            required
            disabled={busy}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${formId}-name-error` : undefined}
          />
          {errors.name && <small className="field__error" id={`${formId}-name-error`}>{errors.name}</small>}
        </div>

        <div className="field">
          <label htmlFor={`${formId}-ip-address`}>Địa chỉ IP <strong aria-hidden="true">*</strong></label>
          <input
            id={`${formId}-ip-address`}
            name="ip_address"
            value={values.ip_address}
            onChange={handleChange}
            maxLength={45}
            placeholder="Ví dụ: 192.168.1.1"
            required
            disabled={busy}
            aria-invalid={Boolean(errors.ip_address)}
            aria-describedby={errors.ip_address ? `${formId}-ip-error` : undefined}
          />
          {errors.ip_address && <small className="field__error" id={`${formId}-ip-error`}>{errors.ip_address}</small>}
        </div>

        <div className="field">
          <label htmlFor={`${formId}-location`}>Vị trí</label>
          <input
            id={`${formId}-location`}
            name="location"
            value={values.location}
            onChange={handleChange}
            maxLength={150}
            placeholder="Ví dụ: Phòng Lab"
            disabled={busy}
            aria-invalid={Boolean(errors.location)}
            aria-describedby={errors.location ? `${formId}-location-error` : undefined}
          />
          {errors.location && <small className="field__error" id={`${formId}-location-error`}>{errors.location}</small>}
        </div>

        <div className="field">
          <label htmlFor={`${formId}-status`}>Trạng thái</label>
          <select id={`${formId}-status`} name="status" value={values.status} onChange={handleChange} disabled={busy}>
            <option value="unknown">Chưa xác định</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>

      <div className="form-actions">
        <button className="button button--secondary" type="button" onClick={onCancel} disabled={busy}>
          Hủy
        </button>
        <button className="button button--primary" type="submit" disabled={busy}>
          {busy ? "Đang lưu..." : device ? "Lưu thay đổi" : "Thêm thiết bị"}
        </button>
      </div>
    </form>
  );
}
