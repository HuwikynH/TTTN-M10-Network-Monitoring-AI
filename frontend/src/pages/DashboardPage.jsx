import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { alertApi, dashboardApi, deviceApi, USE_MOCK_DATA } from "../api/api";
import DemoDataBadge from "../components/DemoDataBadge";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import useAutoRefresh, { getRefreshInterval } from "../hooks/useAutoRefresh";
import { activeAlerts, deviceNameMap, formatDateTime, formatRelativeTime, highestAlertLevel, isStale } from "../utils";

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summaryFallback, setSummaryFallback] = useState(false);
  const intervalMs = getRefreshInterval();
  const polling = useAutoRefresh(async (signal) => {
    const [deviceData, alertData] = await Promise.all([deviceApi.list({ signal }), alertApi.list({ limit: 100, signal })]);
    let summaryData;
    let fallback = false;
    try { summaryData = await dashboardApi.getSummary({ signal }); }
    catch (error) {
      if (error.status !== 404) throw error;
      fallback = true;
      summaryData = {
        total_devices: deviceData.length,
        online_devices: deviceData.filter((item) => item.status === "online").length,
        offline_devices: deviceData.filter((item) => item.status === "offline").length,
        unknown_devices: deviceData.filter((item) => item.status === "unknown").length,
        open_alerts: alertData.filter((item) => item.status === "open").length,
        critical_alerts: alertData.filter((item) => item.status === "open" && item.level === "critical").length,
        total_metrics: null,
        last_metric_at: null,
      };
    }
    setDevices(deviceData);
    setAlerts(alertData);
    setSummary(summaryData);
    setSummaryFallback(fallback);
  }, { intervalMs });
  const names = useMemo(() => deviceNameMap(devices), [devices]);
  const cards = summary ? [
    ["Thiết bị hoạt động", `${summary.online_devices}/${summary.total_devices}`, summary.offline_devices ? "warning" : "success"],
    ["Thiết bị mất kết nối", summary.offline_devices, summary.offline_devices ? "critical" : "neutral"],
    ["Cảnh báo đang mở", summary.open_alerts, summary.open_alerts ? "warning" : "neutral"],
    ["Cảnh báo nghiêm trọng", summary.critical_alerts, summary.critical_alerts ? "critical" : "neutral"],
  ] : [];
  const dataStatus = polling.error ? "disconnected" : isStale(summary?.last_metric_at, intervalMs) ? "stale" : "live";
  const relevantAlerts = useMemo(() => activeAlerts(alerts), [alerts]);
  const priorityDevices = useMemo(() => devices.map((device) => {
    const deviceAlerts = relevantAlerts.filter((alert) => alert.device_id === device.id);
    const latestAlert = [...deviceAlerts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    return {
      ...device,
      alertCount: deviceAlerts.length,
      highestLevel: highestAlertLevel(deviceAlerts),
      latestAlert,
    };
  }).filter((device) => device.status !== "online" || device.alertCount).sort((a, b) => {
    const rank = { critical: 3, warning: 2, info: 1 };
    const levelDifference = (rank[b.highestLevel] || 0) - (rank[a.highestLevel] || 0);
    return levelDifference || b.alertCount - a.alertCount;
  }).slice(0, 5), [devices, relevantAlerts]);

  return (
    <div className="page">
      <PageHeader eyebrow="Tổng quan hệ thống" title="Network Operations Center" description="Theo dõi sức khỏe thiết bị, metric và cảnh báo từ một không gian điều hành thống nhất." actions={<div className="page-header-action-group">{USE_MOCK_DATA && <DemoDataBadge />}<Link className="button button--primary" to="/traffic">Mở giám sát trực tiếp</Link></div>} />
      {polling.error && <ErrorBanner message={polling.error.message} onRetry={polling.refresh} />}
      {polling.isInitialLoading && !summary ? <LoadingState /> : polling.error && !summary ? (
        <section className="panel"><EmptyState title="Chưa thể tải dữ liệu tổng quan" description="Kết nối lại Backend rồi nhấn Thử lại để tải trạng thái hệ thống." /></section>
      ) : (
        <>
          <section className="system-strip">
            <div><span className="section-label">Trạng thái dữ liệu</span><div className="status-with-refresh"><StatusBadge status={dataStatus} /><span className={"background-refresh-status" + (polling.isRefreshing ? " background-refresh-status--active" : "")} aria-live="polite">{polling.isRefreshing ? "Đang cập nhật" : ""}</span></div></div>
            <div><span className="section-label">Metric gần nhất</span><strong>{formatDateTime(summary?.last_metric_at)}</strong></div>
            <div><span className="section-label">Chu kỳ cập nhật</span><strong>{Math.round(intervalMs / 1000)} giây</strong></div>
            {summaryFallback && <span className="fallback-note">Backend cũ: số liệu đang được tính từ danh sách hiện có.</span>}
          </section>
          <section className="kpi-grid kpi-grid--dashboard" aria-label="Chỉ số tổng quan">
            {cards.map(([label, value, tone]) => <article className={"kpi-card kpi-card--" + tone} key={label}><span>{label}</span><strong>{value}</strong></article>)}
          </section>
          <section className="panel priority-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Ưu tiên xử lý</p><h2>Thiết bị cần chú ý</h2><p>Sắp xếp theo mức độ cảnh báo và số sự kiện đang hoạt động.</p></div>
              <Link to="/alerts">Mở trung tâm cảnh báo</Link>
            </div>
            {!priorityDevices.length ? <EmptyState title="Hệ thống đang ổn định" description="Không có thiết bị offline hoặc cảnh báo đang hoạt động." /> : (
              <div className="priority-list">
                {priorityDevices.map((device) => (
                  <Link className="priority-row" key={device.id} to={"/devices/" + device.id}>
                    <span className={"priority-indicator priority-indicator--" + (device.highestLevel || device.status)} />
                    <div className="priority-device"><strong>{device.name}</strong><span className="mono">{device.ip_address}</span></div>
                    <div className="priority-cause"><strong>{device.latestAlert?.message || "Thiết bị không phản hồi"}</strong><span>{device.alertCount ? `${device.alertCount} cảnh báo đang hoạt động` : "Mất kết nối"}</span></div>
                    <StatusBadge status={device.highestLevel || device.status} />
                    <span className="priority-time">{formatRelativeTime(device.latestAlert?.created_at || device.updated_at)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <div className="dashboard-columns">
            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Hạ tầng</p><h2>Thiết bị gần đây</h2></div><Link to="/devices">Xem tất cả</Link></div>
              {!devices.length ? <EmptyState title="Chưa có thiết bị" description="Thêm thiết bị để bắt đầu giám sát." action={<Link className="button button--primary" to="/devices">Quản lý thiết bị</Link>} /> : (
                <div className="compact-list">{devices.slice(0, 6).map((device) => <Link className="compact-row" key={device.id} to={"/devices/" + device.id}><div><strong>{device.name}</strong><span className="mono">{device.ip_address}</span></div><StatusBadge status={device.status} /></Link>)}</div>
              )}
            </section>
            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Sự kiện</p><h2>Cảnh báo mới nhất</h2></div><Link to="/alerts">Xem tất cả</Link></div>
              {!alerts.length ? <EmptyState title="Không có cảnh báo" description="Hệ thống chưa ghi nhận cảnh báo nào." /> : (
                <div className="alert-list">{alerts.slice(0, 6).map((alert) => <Link className="alert-row alert-row--link" to={"/devices/" + alert.device_id} key={alert.id}><span className={"severity-marker severity-marker--" + alert.level} /><div><strong>{names.get(alert.device_id) || "Thiết bị #" + alert.device_id}</strong><p>{alert.message}</p><time>{formatDateTime(alert.created_at)}</time></div><StatusBadge status={alert.status} /></Link>)}</div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
