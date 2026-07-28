import { useMemo, useRef, useState } from "react";
import { alertApi, deviceApi } from "../api/api";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import useAutoRefresh from "../hooks/useAutoRefresh";
import { deviceNameMap, formatDateTime } from "../utils";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const updatingRef = useRef(null);
  const [actionError, setActionError] = useState("");
  const polling = useAutoRefresh(async (signal) => {
    const [alertData, deviceData] = await Promise.all([alertApi.list({ limit: 100, signal }), deviceApi.list({ signal })]);
    setAlerts(alertData);
    setDevices(deviceData);
  });
  const names = useMemo(() => deviceNameMap(devices), [devices]);
  const filtered = useMemo(() => alerts.filter((alert) => (levelFilter === "all" || alert.level === levelFilter) && (statusFilter === "all" || alert.status === statusFilter)), [alerts, levelFilter, statusFilter]);
  const updateStatus = async (alert, status) => {
    if (updatingRef.current) return;
    if (status === "resolved" && !window.confirm("Đánh dấu cảnh báo này là đã xử lý?")) return;
    updatingRef.current = alert.id;
    setUpdatingId(alert.id);
    setActionError("");
    try {
      const updated = await alertApi.updateStatus(alert.id, status);
      setAlerts((current) => current.map((item) => item.id === updated.id ? updated : item));
      await polling.refresh();
    } catch (error) { setActionError(error.message); }
    finally { updatingRef.current = null; setUpdatingId(null); }
  };
  return (
    <div className="page">
      <PageHeader eyebrow="Quản lý sự cố" title="Cảnh báo" description="Xác nhận, theo dõi và đóng các cảnh báo được sinh từ metric thiết bị." actions={<div className="page-header-action-group"><span className={"background-refresh-status" + (polling.isRefreshing ? " background-refresh-status--active" : "")} aria-live="polite">{polling.isRefreshing ? "Đang cập nhật" : ""}</span><button className="button button--secondary stable-refresh-button" type="button" onClick={polling.refresh} disabled={polling.isRefreshing}>Tải lại</button></div>} />
      {(polling.error || actionError) && <ErrorBanner message={actionError || polling.error.message} onRetry={polling.refresh} />}
      <section className="panel">
        <div className="filter-bar filter-bar--alerts">
          <div className="field field--filter"><label htmlFor="alert-level">Mức độ</label><select id="alert-level" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}><option value="all">Tất cả</option><option value="info">Thông tin</option><option value="warning">Cảnh báo</option><option value="critical">Nghiêm trọng</option></select></div>
          <div className="field field--filter"><label htmlFor="alert-status">Trạng thái</label><select id="alert-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tất cả</option><option value="open">Đang mở</option><option value="acknowledged">Đã xác nhận</option><option value="resolved">Đã xử lý</option></select></div>
          <span className="filter-count">{filtered.length} cảnh báo</span>
        </div>
        {polling.isInitialLoading && !alerts.length ? <LoadingState /> : polling.error && !polling.lastSuccessAt && !alerts.length ? <EmptyState title="Chưa thể tải danh sách cảnh báo" description="Kết nối lại Backend rồi thử tải dữ liệu." /> : !alerts.length ? <EmptyState title="Không có cảnh báo" description="Hệ thống chưa ghi nhận cảnh báo nào." /> : !filtered.length ? <EmptyState title="Không có kết quả phù hợp" description="Hãy điều chỉnh bộ lọc mức độ hoặc trạng thái." /> : (
          <div className="table-wrap"><table><thead><tr><th>Thời gian</th><th>Thiết bị</th><th>Mức độ</th><th>Nội dung</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>{filtered.map((alert) => <tr key={alert.id}><td className="nowrap">{formatDateTime(alert.created_at)}</td><td><strong>{names.get(alert.device_id) || "Thiết bị #" + alert.device_id}</strong></td><td><StatusBadge status={alert.level} /></td><td className="alert-message-cell">{alert.message}</td><td><StatusBadge status={alert.status} /></td><td><div className="table-actions">{alert.status === "open" && <button className="text-button" type="button" disabled={updatingId === alert.id} onClick={() => updateStatus(alert, "acknowledged")}>Xác nhận</button>}{alert.status !== "resolved" && <button className="text-button text-button--success" type="button" disabled={updatingId === alert.id} onClick={() => updateStatus(alert, "resolved")}>Đánh dấu đã xử lý</button>}</div></td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
