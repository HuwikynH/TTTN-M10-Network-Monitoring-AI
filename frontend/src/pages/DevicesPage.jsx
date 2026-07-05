import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { deviceApi } from "../api/api";
import ConfirmDialog from "../components/ConfirmDialog";
import DeviceForm from "../components/DeviceForm";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import { EmptyState, ErrorMessage } from "../components/StateFeedback";
import StatusBadge from "../components/StatusBadge";

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const mountedRef = useRef(false);
  const actionControllerRef = useRef(null);

  const loadDevices = useCallback(async () => {
    const controller = new AbortController();
    actionControllerRef.current = controller;
    if (mountedRef.current) setLoading(true);

    try {
      const data = await deviceApi.list({ signal: controller.signal });
      if (!mountedRef.current) return;
      setDevices(data || []);
      setError("");
    } catch (requestError) {
      if (requestError.name !== "AbortError" && mountedRef.current) setError(requestError.message);
    } finally {
      if (actionControllerRef.current === controller) actionControllerRef.current = null;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadDevices();
    return () => {
      mountedRef.current = false;
      actionControllerRef.current?.abort();
    };
  }, [loadDevices]);

  useEffect(() => {
    if (!formOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) closeForm();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formOpen, submitting]);

  const openCreateForm = () => {
    setEditingDevice(null);
    setFormError("");
    setFormOpen(true);
  };

  const openEditForm = (device) => {
    setEditingDevice(device);
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setFormOpen(false);
    setEditingDevice(null);
    setFormError("");
  };

  const handleSubmit = async (values) => {
    const controller = new AbortController();
    actionControllerRef.current = controller;
    setSubmitting(true);
    setFormError("");

    try {
      const savedDevice = editingDevice
        ? await deviceApi.update(editingDevice.id, values, { signal: controller.signal })
        : await deviceApi.create(values, { signal: controller.signal });

      if (!mountedRef.current) return;
      setDevices((current) =>
        editingDevice
          ? current.map((device) => (device.id === savedDevice.id ? savedDevice : device))
          : [...current, savedDevice].sort((first, second) => first.id - second.id),
      );
      setFormOpen(false);
      setEditingDevice(null);
      setError("");
    } catch (requestError) {
      if (requestError.name !== "AbortError" && mountedRef.current) {
        setFormError(requestError.message);
      }
    } finally {
      if (actionControllerRef.current === controller) actionControllerRef.current = null;
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const controller = new AbortController();
    actionControllerRef.current = controller;
    setDeleting(true);

    try {
      await deviceApi.remove(deleteTarget.id, { signal: controller.signal });
      if (!mountedRef.current) return;
      setDevices((current) => current.filter((device) => device.id !== deleteTarget.id));
      setDeleteTarget(null);
      setError("");
    } catch (requestError) {
      if (requestError.name !== "AbortError" && mountedRef.current) {
        setError(requestError.message);
        setDeleteTarget(null);
      }
    } finally {
      if (actionControllerRef.current === controller) actionControllerRef.current = null;
      if (mountedRef.current) setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Hạ tầng mạng"
        title="Quản lý thiết bị"
        description="Thêm, cập nhật và theo dõi toàn bộ thiết bị mạng."
        actions={<button className="button button--primary" type="button" onClick={openCreateForm}>+ Thêm thiết bị</button>}
      />

      <ErrorMessage message={error} onRetry={loadDevices} />

      <section className="panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Danh sách</p><h2>Thiết bị mạng</h2></div>
          <span className="record-count">{devices.length} thiết bị</span>
        </div>

        {loading && devices.length === 0 ? (
          <Loading message="Đang tải danh sách thiết bị..." />
        ) : devices.length === 0 ? (
          <EmptyState
            title="Chưa có thiết bị"
            message="Thêm thiết bị đầu tiên để bắt đầu giám sát."
            action={<button className="button button--primary" type="button" onClick={openCreateForm}>Thêm thiết bị</button>}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Tên thiết bị</th><th>Địa chỉ IP</th><th>Vị trí</th><th>Trạng thái</th><th className="table-actions-heading">Thao tác</th></tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id}>
                    <td><strong>{device.name}</strong><small className="cell-subtext">ID #{device.id}</small></td>
                    <td className="mono">{device.ip_address}</td>
                    <td>{device.location || "—"}</td>
                    <td><StatusBadge status={device.status} /></td>
                    <td>
                      <div className="table-actions">
                        <Link className="icon-button" to={`/devices/${device.id}`} aria-label={`Xem chi tiết ${device.name}`}>Xem</Link>
                        <button className="icon-button" type="button" onClick={() => openEditForm(device)} aria-label={`Sửa ${device.name}`}>Sửa</button>
                        <button className="icon-button icon-button--danger" type="button" onClick={() => setDeleteTarget(device)} aria-label={`Xóa ${device.name}`}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="modal-backdrop" onMouseDown={closeForm}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="device-form-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <div>
                <p className="eyebrow">{editingDevice ? "Cập nhật thiết bị" : "Thiết bị mới"}</p>
                <h2 id="device-form-title">{editingDevice ? "Sửa thiết bị" : "Thêm thiết bị mới"}</h2>
              </div>
              <button className="modal__close" type="button" onClick={closeForm} disabled={submitting} aria-label="Đóng">×</button>
            </div>
            <DeviceForm
              device={editingDevice}
              busy={submitting}
              submitError={formError}
              onSubmit={handleSubmit}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa thiết bị?"
        message={deleteTarget ? `Thiết bị “${deleteTarget.name}” và dữ liệu liên quan sẽ bị xóa khỏi hệ thống.` : ""}
        confirmLabel="Xóa thiết bị"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
