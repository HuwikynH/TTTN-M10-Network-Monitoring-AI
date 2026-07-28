import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { alertApi, deviceApi } from "../api/api";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import useAutoRefresh from "../hooks/useAutoRefresh";
import { deviceNameMap, formatDateTime, formatRelativeTime, groupAlerts } from "../utils";

const PAGE_SIZE = 10;

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState("");
  const updatingRef = useRef(null);
  const [actionError, setActionError] = useState("");
  const polling = useAutoRefresh(async (signal) => {
    const [alertData, deviceData] = await Promise.all([
      alertApi.list({ limit: 100, signal }),
      deviceApi.list({ signal }),
    ]);
    setAlerts(alertData);
    setDevices(deviceData);
  });
  const names = useMemo(() => deviceNameMap(devices), [devices]);
  const groups = useMemo(() => groupAlerts(alerts), [alerts]);
  const filtered = useMemo(() => groups.filter((group) => {
    const matchesLevel = levelFilter === "all" || group.level === levelFilter;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "active" ? group.status !== "resolved" : group.status === statusFilter);
    const matchesDevice = deviceFilter === "all" || String(group.device_id) === deviceFilter;
    const deviceName = names.get(group.device_id) || `Thiết bị #${group.device_id}`;
    const keyword = search.trim().toLocaleLowerCase("vi-VN");
    const matchesSearch = !keyword
      || `${deviceName} ${group.category} ${group.latest.message}`.toLocaleLowerCase("vi-VN").includes(keyword);
    return matchesLevel && matchesStatus && matchesDevice && matchesSearch;
  }), [deviceFilter, groups, levelFilter, names, search, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [deviceFilter, levelFilter, search, statusFilter]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const updateStatus = async (group, status) => {
    if (updatingRef.current) return;
    const targetAlerts = group.alerts.filter((alert) => alert.status !== status);
    if (status === "resolved" && !window.confirm(`Đánh dấu ${targetAlerts.length} cảnh báo trong nhóm “${group.category}” là đã xử lý?`)) return;
    updatingRef.current = group.id;
    setUpdatingId(group.id);
    setActionError("");
    try {
      const updatedAlerts = [];
      for (const alert of targetAlerts) updatedAlerts.push(await alertApi.updateStatus(alert.id, status));
      const updatedById = new Map(updatedAlerts.map((alert) => [alert.id, alert]));
      setAlerts((current) => current.map((item) => updatedById.get(item.id) || item));
      await polling.refresh();
    } catch (error) {
      setActionError(error.message);
    } finally {
      updatingRef.current = null;
      setUpdatingId("");
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Trung tâm xử lý sự cố"
        title="Cảnh báo"
        description="Các cảnh báo giống nhau được gom thành nhóm để bạn ưu tiên và xử lý nhanh hơn."
        actions={(
          <div className="page-header-action-group">
            <span className={"background-refresh-status" + (polling.isRefreshing ? " background-refresh-status--active" : "")} aria-live="polite">{polling.isRefreshing ? "Đang cập nhật" : ""}</span>
            <button className="button button--secondary stable-refresh-button" type="button" onClick={polling.refresh} disabled={polling.isRefreshing}>Tải lại</button>
          </div>
        )}
      />
      {(polling.error || actionError) && <ErrorBanner message={actionError || polling.error.message} onRetry={polling.refresh} />}
      <section className="panel">
        <div className="filter-bar filter-bar--alerts">
          <div className="field field--search"><label htmlFor="alert-search">Tìm kiếm</label><input id="alert-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Thiết bị hoặc nội dung" /></div>
          <div className="field field--filter"><label htmlFor="alert-device">Thiết bị</label><select id="alert-device" value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value)}><option value="all">Tất cả thiết bị</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></div>
          <div className="field field--filter"><label htmlFor="alert-level">Mức độ</label><select id="alert-level" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}><option value="all">Tất cả</option><option value="info">Thông tin</option><option value="warning">Cảnh báo</option><option value="critical">Nghiêm trọng</option></select></div>
          <div className="field field--filter"><label htmlFor="alert-status">Trạng thái</label><select id="alert-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Cần xử lý</option><option value="open">Đang mở</option><option value="acknowledged">Đã xác nhận</option><option value="resolved">Đã xử lý</option><option value="all">Tất cả</option></select></div>
        </div>
        <div className="incident-summary">
          <div><strong>{filtered.length}</strong><span>nhóm sự cố</span></div>
          <div><strong>{filtered.reduce((total, group) => total + group.alerts.length, 0)}</strong><span>cảnh báo tương ứng</span></div>
          <p>Các cảnh báo cùng thiết bị và nguyên nhân được gom lại để giảm nhiễu.</p>
        </div>
        {polling.isInitialLoading && !alerts.length ? <LoadingState /> : polling.error && !polling.lastSuccessAt && !alerts.length ? <EmptyState title="Chưa thể tải danh sách cảnh báo" description="Kết nối lại Backend rồi thử tải dữ liệu." /> : !alerts.length ? <EmptyState title="Không có cảnh báo" description="Hệ thống chưa ghi nhận cảnh báo nào." /> : !filtered.length ? <EmptyState title="Không có kết quả phù hợp" description="Hãy thay đổi từ khóa hoặc bộ lọc cảnh báo." /> : (
          <>
            <div className="incident-list">
              {paginated.map((group) => (
                <article className={"incident-row incident-row--" + group.level} key={group.id}>
                  <div className="incident-main">
                    <div className="incident-title"><Link to={"/devices/" + group.device_id}>{names.get(group.device_id) || "Thiết bị #" + group.device_id}</Link><StatusBadge status={group.level} /><StatusBadge status={group.status} /></div>
                    <strong>{group.category}</strong>
                    <p>{group.latest.message}</p>
                    <span>Cập nhật {formatRelativeTime(group.latest.created_at)} · {formatDateTime(group.latest.created_at)}</span>
                  </div>
                  <div className="incident-count"><strong>{group.alerts.length}</strong><span>lần lặp</span></div>
                  <div className="incident-actions">
                    {group.status === "open" && <button className="button button--secondary" type="button" disabled={updatingId === group.id} onClick={() => updateStatus(group, "acknowledged")}>Xác nhận</button>}
                    {group.status !== "resolved" && <button className="button button--primary" type="button" disabled={updatingId === group.id} onClick={() => updateStatus(group, "resolved")}>Đã xử lý</button>}
                  </div>
                </article>
              ))}
            </div>
            <div className="pagination">
              <span>Trang {page}/{totalPages}</span>
              <div><button className="button button--secondary" type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Trước</button><button className="button button--secondary" type="button" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Sau</button></div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
