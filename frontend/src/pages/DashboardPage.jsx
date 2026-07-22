import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { alertApi, dashboardApi, deviceApi } from "../api/api";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import useAutoRefresh, { getRefreshInterval } from "../hooks/useAutoRefresh";
import { deviceNameMap, formatDateTime, isStale } from "../utils";

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summaryFallback, setSummaryFallback] = useState(false);
  const intervalMs = getRefreshInterval();
  const polling = useAutoRefresh(async (signal) => {
    const [deviceData, alertData] = await Promise.all([deviceApi.list({ signal }), alertApi.list({ limit: 8, signal })]);
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
    ["Tổng thiết bị", summary.total_devices, "neutral"],
    ["Online", summary.online_devices, "success"],
    ["Offline", summary.offline_devices, "critical"],
    ["Chưa xác định", summary.unknown_devices, "muted"],
    ["Cảnh báo đang mở", summary.open_alerts, "warning"],
    ["Cảnh báo Critical", summary.critical_alerts, "critical"],
    ["Tổng số metrics", summary.total_metrics ?? "—", "info"],
  ] : [];
  const dataStatus = polling.error ? "disconnected" : polling.isRefreshing ? "refreshing" : isStale(summary?.last_metric_at, intervalMs) ? "stale" : "live";

  return (
    <div className="page">
      <PageHeader eyebrow="Tổng quan hệ thống" title="Network Operations Center" description="Theo dõi sức khỏe thiết bị, metric và cảnh báo từ một không gian điều hành thống nhất." actions={<Link className="button button--primary" to="/traffic">Mở giám sát trực tiếp</Link>} />
      {polling.error && <ErrorBanner message={polling.error.message} onRetry={polling.refresh} />}
      {polling.isInitialLoading && !summary ? <LoadingState /> : polling.error && !summary ? (
        <section className="panel"><EmptyState title="Chưa thể tải dữ liệu tổng quan" description="Kết nối lại Backend rồi nhấn Thử lại để tải trạng thái hệ thống." /></section>
      ) : (
        <>
          <section className="system-strip">
            <div><span className="section-label">Trạng thái dữ liệu</span><StatusBadge status={dataStatus} /></div>
            <div><span className="section-label">Metric gần nhất</span><strong>{formatDateTime(summary?.last_metric_at)}</strong></div>
            <div><span className="section-label">Chu kỳ cập nhật</span><strong>{Math.round(intervalMs / 1000)} giây</strong></div>
            {summaryFallback && <span className="fallback-note">Backend cũ: số liệu đang được tính từ danh sách hiện có.</span>}
          </section>
          <section className="kpi-grid kpi-grid--dashboard" aria-label="Chỉ số tổng quan">
            {cards.map(([label, value, tone]) => <article className={"kpi-card kpi-card--" + tone} key={label}><span>{label}</span><strong>{value}</strong></article>)}
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
                <div className="alert-list">{alerts.slice(0, 6).map((alert) => <article className="alert-row" key={alert.id}><span className={"severity-marker severity-marker--" + alert.level} /><div><strong>{names.get(alert.device_id) || "Thiết bị #" + alert.device_id}</strong><p>{alert.message}</p><time>{formatDateTime(alert.created_at)}</time></div><StatusBadge status={alert.status} /></article>)}</div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
