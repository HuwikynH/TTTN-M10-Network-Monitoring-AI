import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { alertApi, dashboardApi, deviceApi, metricApi } from "../api/api";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LiveConnectionBadge from "../components/LiveConnectionBadge";
import LoadingState from "../components/LoadingState";
import MetricChart from "../components/MetricChart";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import useAutoRefresh, { getRefreshInterval } from "../hooks/useAutoRefresh";
import { deviceNameMap, formatDateTime, formatMetric, isStale, newestMetric, sortMetricsAscending } from "../utils";

const RANGE_OPTIONS = [{ value: 5, label: "5 phút" }, { value: 10, label: "10 phút" }, { value: 30, label: "30 phút" }];
const statusText = { online: "Online", offline: "Offline", unknown: "Chưa xác định" };
const severityRank = { info: 1, warning: 2, critical: 3 };

export default function TrafficMonitorPage() {
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [rangeMinutes, setRangeMinutes] = useState(10);
  const intervalMs = getRefreshInterval();
  const polling = useAutoRefresh(async (signal) => {
    const requests = [deviceApi.list({ signal }), alertApi.list({ limit: 100, signal }), dashboardApi.getSummary({ signal })];
    if (selectedDeviceId) requests.push(metricApi.listByDevice({ deviceId: selectedDeviceId, limit: 120, signal }));
    const [deviceData, alertData, summaryData, metricData] = await Promise.all(requests);
    setDevices(deviceData);
    setAlerts(alertData);
    setSummary(summaryData);
    if (metricData) setMetrics(metricData);
    setSelectedDeviceId((current) => {
      if (current && deviceData.some((device) => String(device.id) === String(current))) return current;
      const preferred = deviceData.find((device) => device.status === "online") || deviceData[0];
      return preferred ? String(preferred.id) : "";
    });
    if (!deviceData.length) setMetrics([]);
  }, { intervalMs });
  useEffect(() => {
    if (selectedDeviceId) polling.refresh();
  }, [selectedDeviceId, polling.refresh]);

  const selectedDevice = useMemo(() => devices.find((device) => String(device.id) === String(selectedDeviceId)) || null, [devices, selectedDeviceId]);
  const sortedMetrics = useMemo(() => sortMetricsAscending(metrics).slice(-120), [metrics]);
  const filteredMetrics = useMemo(() => {
    const cutoff = Date.now() - rangeMinutes * 60 * 1000;
    return sortedMetrics.filter((metric) => new Date(metric.collected_at).getTime() >= cutoff);
  }, [rangeMinutes, sortedMetrics]);
  const chartData = filteredMetrics.length ? filteredMetrics : sortedMetrics;
  const latest = useMemo(() => newestMetric(metrics), [metrics]);
  const names = useMemo(() => deviceNameMap(devices), [devices]);
  const openAlerts = useMemo(() => alerts.filter((alert) => alert.status === "open"), [alerts]);
  const abnormalDevices = useMemo(() => devices.map((device) => {
    const relevant = openAlerts.filter((alert) => alert.device_id === device.id && ["warning", "critical"].includes(alert.level));
    relevant.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const highest = relevant.reduce((level, alert) => severityRank[alert.level] > severityRank[level || "info"] ? alert.level : level, relevant[0]?.level);
    return { ...device, relevant, highest, latestAlert: relevant[0] };
  }).filter((device) => device.status === "offline" || device.relevant.length), [devices, openAlerts]);
  const liveStatus = polling.paused ? "paused" : polling.error ? "disconnected" : polling.isRefreshing ? "refreshing" : isStale(latest?.collected_at || summary?.last_metric_at, intervalMs) ? "stale" : "live";

  return (
    <div className="page">
      <PageHeader eyebrow="Cập nhật gần thời gian thực" title="Giám sát trực tiếp" description="REST polling theo dõi trạng thái và metric của từng thiết bị; không phải phân tích packet hoặc NetFlow." />
      <LiveConnectionBadge status={liveStatus} lastUpdated={polling.lastSuccessAt} intervalMs={intervalMs} onToggle={polling.togglePaused} onRefresh={polling.refresh} refreshing={polling.isRefreshing} />
      {polling.error && <ErrorBanner message={polling.error.message} onRetry={polling.refresh} />}
      {polling.isInitialLoading && !devices.length ? <LoadingState /> : polling.error && !polling.lastSuccessAt && !devices.length ? <EmptyState title="Chưa thể tải danh sách thiết bị" description="Backend đang mất kết nối. Dữ liệu giám sát sẽ tự phục hồi khi dịch vụ hoạt động lại." /> : !devices.length ? <EmptyState title="Chưa có thiết bị để giám sát" description="Thêm thiết bị trong danh mục để bắt đầu nhận metric." action={<Link className="button button--primary" to="/devices">Quản lý thiết bị</Link>} /> : (
        <>
          <section className="monitor-controls panel">
            <div className="field"><label htmlFor="monitor-device">Thiết bị đang theo dõi</label><select id="monitor-device" value={selectedDeviceId} onChange={(event) => { setSelectedDeviceId(event.target.value); setMetrics([]); }}>{devices.map((device) => <option key={device.id} value={device.id}>{device.name} — {device.ip_address} — {statusText[device.status] || device.status}</option>)}</select></div>
            <div className="field"><label htmlFor="monitor-range">Khoảng thời gian</label><select id="monitor-range" value={rangeMinutes} onChange={(event) => setRangeMinutes(Number(event.target.value))}>{RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            <div className="selected-device-status"><span className="section-label">Trạng thái thiết bị</span><StatusBadge status={selectedDevice?.status} /></div>
          </section>
          <section className="kpi-grid kpi-grid--metrics">
            <article className="kpi-card"><span>Latency gần nhất</span><strong>{formatMetric(latest?.latency_ms, "ms")}</strong></article>
            <article className="kpi-card"><span>Packet loss gần nhất</span><strong>{formatMetric(latest?.packet_loss_percent, "%")}</strong></article>
            <article className="kpi-card"><span>CPU gần nhất</span><strong>{formatMetric(latest?.cpu_percent, "%")}</strong></article>
            <article className="kpi-card"><span>RAM gần nhất</span><strong>{formatMetric(latest?.memory_percent, "%")}</strong></article>
            <article className="kpi-card"><span>Bandwidth gần nhất</span><strong>{formatMetric(latest?.bandwidth_mbps, "Mbps")}</strong></article>
            <article className="kpi-card kpi-card--wide"><span>Metric gần nhất</span><strong className="kpi-card__date">{formatDateTime(latest?.collected_at)}</strong></article>
          </section>
          <div className="charts-grid">
            <MetricChart title="Bandwidth" description="Bandwidth của thiết bị được chọn" data={chartData} lines={[{ dataKey: "bandwidth_mbps", name: "Bandwidth", color: "var(--chart-green)" }]} unit="Mbps" />
            <MetricChart title="Latency" description="Độ trễ phản hồi" data={chartData} lines={[{ dataKey: "latency_ms", name: "Latency", color: "var(--chart-blue)" }]} unit="ms" threshold={100} />
            <MetricChart title="Packet loss" description="Tỷ lệ gói tin thất thoát" data={chartData} lines={[{ dataKey: "packet_loss_percent", name: "Packet loss", color: "var(--chart-orange)" }]} unit="%" domain={[0, 100]} threshold={20} />
            <MetricChart title="CPU và RAM" description="Tài nguyên thiết bị" data={chartData} lines={[{ dataKey: "cpu_percent", name: "CPU", color: "var(--chart-purple)" }, { dataKey: "memory_percent", name: "RAM", color: "var(--chart-teal)" }]} unit="%" domain={[0, 100]} threshold={90} />
          </div>
          <div className="monitor-bottom-grid">
            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Luồng sự kiện</p><h2>Cảnh báo gần đây</h2></div><Link to="/alerts">Xem tất cả cảnh báo</Link></div>
              {!alerts.length ? <EmptyState title="Không có cảnh báo" description="Chưa ghi nhận cảnh báo từ các thiết bị." /> : <div className="alert-list">{alerts.slice(0, 7).map((alert) => <article className="alert-row" key={alert.id}><span className={"severity-marker severity-marker--" + alert.level} /><div><strong>{names.get(alert.device_id) || "Thiết bị #" + alert.device_id}</strong><p>{alert.message}</p><time>{formatDateTime(alert.created_at)}</time></div><div className="alert-row__badges"><StatusBadge status={alert.level} /><StatusBadge status={alert.status} /></div></article>)}</div>}
            </section>
            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">Ưu tiên xử lý</p><h2>Thiết bị bất thường</h2></div></div>
              {!abnormalDevices.length ? <EmptyState title="Không có thiết bị bất thường" description="Không có thiết bị offline hoặc cảnh báo warning/critical đang mở." /> : <div className="table-wrap"><table><thead><tr><th>Thiết bị</th><th>Trạng thái</th><th>Cảnh báo mở</th><th>Mức cao nhất</th><th>Nội dung mới nhất</th></tr></thead><tbody>{abnormalDevices.map((device) => <tr key={device.id}><td><Link className="table-primary" to={"/devices/" + device.id}>{device.name}</Link><span className="table-secondary mono">{device.ip_address}</span></td><td><StatusBadge status={device.status} /></td><td>{device.relevant.length}</td><td>{device.highest ? <StatusBadge status={device.highest} /> : "—"}</td><td>{device.latestAlert?.message || "Thiết bị đang offline"}</td></tr>)}</tbody></table></div>}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
