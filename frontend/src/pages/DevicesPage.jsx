import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { alertApi, deviceApi } from "../api/api";
import ConfirmDialog from "../components/ConfirmDialog";
import DeviceForm from "../components/DeviceForm";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import useAutoRefresh from "../hooks/useAutoRefresh";
import { activeAlerts, formatRelativeTime, highestAlertLevel } from "../utils";

const DEVICE_REFRESH_INTERVAL_MS = 20_000;

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const interactionOpen = creating || Boolean(editing) || Boolean(deleteTarget) || formSubmitting || deleting;
  const polling = useAutoRefresh(async (signal) => {
    const [deviceData, alertData] = await Promise.all([
      deviceApi.list({ signal }),
      alertApi.list({ limit: 100, signal }),
    ]);
    setDevices(deviceData);
    setAlerts(alertData);
  }, {
    enabled: !interactionOpen,
    intervalMs: DEVICE_REFRESH_INTERVAL_MS,
    refreshOnResume: false,
  });
  const enrichedDevices = useMemo(() => {
    const relevantAlerts = activeAlerts(alerts);
    return devices.map((device) => {
      const deviceAlerts = relevantAlerts.filter((alert) => alert.device_id === device.id);
      const latestAlert = [...deviceAlerts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      return {
        ...device,
        alertCount: deviceAlerts.length,
        health: device.status !== "online" ? "critical" : highestAlertLevel(deviceAlerts) || "healthy",
        latestAlert,
      };
    });
  }, [alerts, devices]);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("vi");
    return enrichedDevices.filter((device) => {
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "attention" ? device.health !== "healthy" : device.status === statusFilter);
      const matchesSearch = !term || [device.name, device.ip_address, device.location, device.latestAlert?.message].some((value) => value?.toLocaleLowerCase("vi").includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [enrichedDevices, search, statusFilter]);

  const closeForm = useCallback(() => {
    if (formSubmitting) return;
    setCreating(false);
    setEditing(null);
  }, [formSubmitting]);

  const save = async (payload) => {
    if (editing) await deviceApi.update(editing.id, payload);
    else await deviceApi.create(payload);
    setEditing(null);
    setCreating(false);
    await polling.refresh();
  };
  const remove = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setActionError("");
    try {
      await deviceApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      await polling.refresh();
    }
    catch (error) { setActionError(error.message); }
    finally { setDeleting(false); }
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Quản lý hạ tầng" title="Thiết bị mạng" description="Quản lý danh mục thiết bị. Trạng thái Online/Offline được Backend cập nhật từ metric." actions={<button className="button button--primary" type="button" onClick={() => setCreating(true)}>+ Thêm thiết bị</button>} />
      {(polling.error || actionError) && <ErrorBanner message={actionError || polling.error.message} onRetry={polling.refresh} />}
      <section className="panel">
        <div className="filter-bar">
          <div className="field field--search"><label htmlFor="device-search">Tìm kiếm</label><input id="device-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, IP hoặc vị trí" /></div>
          <div className="field field--filter"><label htmlFor="device-status">Bộ lọc nhanh</label><select id="device-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tất cả thiết bị</option><option value="attention">Cần chú ý</option><option value="online">Đang kết nối</option><option value="offline">Mất kết nối</option><option value="unknown">Chưa xác định</option></select></div>
          <div className="refresh-controls"><span className={"background-refresh-status" + (polling.isRefreshing ? " background-refresh-status--active" : "")} aria-live="polite">{polling.isRefreshing ? "Đang cập nhật" : ""}</span><button className="button button--secondary filter-refresh" type="button" onClick={polling.refresh} disabled={polling.isRefreshing}>Tải lại</button></div>
        </div>
        {polling.isInitialLoading && !devices.length ? <LoadingState /> : polling.error && !polling.lastSuccessAt && !devices.length ? <EmptyState title="Chưa thể tải danh sách thiết bị" description="Kết nối lại Backend rồi thử tải dữ liệu." /> : !devices.length ? <EmptyState title="Chưa có thiết bị" description="Thêm thiết bị đầu tiên để Collector có thể gửi metric." action={<button className="button button--primary" type="button" onClick={() => setCreating(true)}>Thêm thiết bị</button>} /> : !filtered.length ? <EmptyState title="Không tìm thấy thiết bị" description="Hãy thay đổi từ khóa hoặc bộ lọc trạng thái." /> : (
          <div className="table-wrap"><table className="device-health-table"><thead><tr><th>Thiết bị</th><th>Kết nối</th><th>Sức khỏe</th><th>Vấn đề gần nhất</th><th>Cảnh báo mở</th><th>Cập nhật</th><th>Hành động</th></tr></thead><tbody>{filtered.map((device) => <tr key={device.id}><td><Link className="table-primary" to={"/devices/" + device.id}>{device.name}</Link><span className="table-secondary mono">{device.ip_address}</span></td><td><StatusBadge status={device.status} /></td><td><StatusBadge status={device.health === "healthy" ? "online" : device.health} label={device.health === "healthy" ? "Ổn định" : undefined} /></td><td className="device-issue-cell">{device.latestAlert?.message || "Không có cảnh báo hoạt động"}</td><td><strong>{device.alertCount}</strong></td><td title={device.updated_at}>{formatRelativeTime(device.updated_at)}</td><td><div className="table-actions"><button className="text-button" type="button" onClick={() => setEditing(device)}>Sửa</button><button className="text-button text-button--danger" type="button" onClick={() => setDeleteTarget(device)}>Xóa</button></div></td></tr>)}</tbody></table></div>
        )}
      </section>
      {(creating || editing) && <Modal title={editing ? "Chỉnh sửa thiết bị" : "Thêm thiết bị"} onClose={closeForm} closeDisabled={formSubmitting}><DeviceForm device={editing} isOpen onSubmit={save} onCancel={closeForm} onSubmittingChange={setFormSubmitting} /></Modal>}
      <ConfirmDialog open={Boolean(deleteTarget)} title="Xóa thiết bị" description={deleteTarget ? "Xóa thiết bị “" + deleteTarget.name + "” và toàn bộ metric, cảnh báo liên quan?" : ""} confirmLabel="Xóa thiết bị" busy={deleting} onConfirm={remove} onCancel={() => { if (!deleting) setDeleteTarget(null); }} />
    </div>
  );
}
