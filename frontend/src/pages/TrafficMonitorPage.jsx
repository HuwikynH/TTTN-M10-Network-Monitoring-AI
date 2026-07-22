import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { alertApi, dashboardApi, deviceApi, metricApi, trafficApi, USE_MOCK_DATA } from "../api/api";
import DemoDataBadge from "../components/DemoDataBadge";
import DeviceHealthHeatmap from "../components/DeviceHealthHeatmap";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import FlowEmptyState from "../components/FlowEmptyState";
import FlowDataTable from "../components/FlowDataTable";
import LiveConnectionBadge from "../components/LiveConnectionBadge";
import LoadingState from "../components/LoadingState";
import MetricChart from "../components/MetricChart";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import TrafficStatsTable from "../components/TrafficStatsTable";
import TrafficTabs from "../components/TrafficTabs";
import useAutoRefresh, { getRefreshInterval } from "../hooks/useAutoRefresh";
import { deviceNameMap, formatDateTime, formatMetric, isStale, newestMetric, sortMetricsAscending } from "../utils";

const POINT_OPTIONS = [30, 60, 120];
const WIDGET_STORAGE_KEY = "network-monitoring-traffic-widgets";
const DEFAULT_WIDGETS = { summary: true, heatmap: true, bandwidth: true, alarms: true, abnormal: true };
const WIDGET_LABELS = {
  summary: "Tổng quan thiết bị",
  heatmap: "Bản đồ sức khỏe",
  bandwidth: "Biểu đồ bandwidth",
  alarms: "Cảnh báo gần đây",
  abnormal: "Thiết bị bất thường",
};
const statusText = { online: "Online", offline: "Offline", unknown: "Chưa xác định" };
const severityRank = { info: 1, warning: 2, critical: 3 };

function initialWidgets() {
  try {
    const saved = JSON.parse(localStorage.getItem(WIDGET_STORAGE_KEY));
    if (!saved || typeof saved !== "object") return DEFAULT_WIDGETS;
    return Object.fromEntries(Object.keys(DEFAULT_WIDGETS).map((key) => [key, saved[key] !== false]));
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function RecentAlarms({ alerts, names }) {
  if (!alerts.length) return <EmptyState title="Không có cảnh báo" description="Chưa ghi nhận cảnh báo từ các thiết bị." />;
  return <div className="alert-list">{alerts.slice(0, 7).map((alert) => <article className="alert-row" key={alert.id}><span className={"severity-marker severity-marker--" + alert.level} /><div><strong>{names.get(alert.device_id) || "Thiết bị #" + alert.device_id}</strong><p>{alert.message}</p><time>{formatDateTime(alert.created_at)}</time></div><div className="alert-row__badges"><StatusBadge status={alert.level} /><StatusBadge status={alert.status} /></div></article>)}</div>;
}

function AbnormalDevices({ devices }) {
  if (!devices.length) return <EmptyState title="Không có thiết bị bất thường" description="Không có thiết bị offline hoặc cảnh báo warning/critical đang mở." />;
  return <div className="table-wrap"><table><thead><tr><th>Thiết bị</th><th>Trạng thái</th><th>Cảnh báo mở</th><th>Mức cao nhất</th><th>Nội dung mới nhất</th></tr></thead><tbody>{devices.map((device) => <tr key={device.id}><td><Link className="table-primary" to={"/devices/" + device.id}>{device.name}</Link><span className="table-secondary mono">{device.ip_address}</span></td><td><StatusBadge status={device.status} /></td><td>{device.relevant.length}</td><td>{device.highest ? <StatusBadge status={device.highest} /> : "—"}</td><td>{device.latestAlert?.message || "Thiết bị đang offline"}</td></tr>)}</tbody></table></div>;
}

function RawMetricsTable({ metrics }) {
  if (!metrics.length) return <EmptyState title="Chưa có dữ liệu raw" description="Các mẫu metric gần nhất sẽ xuất hiện tại đây." />;
  return (
    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">Raw metrics</p><h2>Dữ liệu gần nhất</h2><p>Tối đa 20 mẫu mới nhất của thiết bị đang chọn.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Thời gian</th><th>Bandwidth báo cáo</th><th>Latency</th><th>Packet loss</th><th>CPU</th><th>RAM</th></tr></thead><tbody>{[...metrics].reverse().slice(0, 20).map((metric) => <tr key={metric.id}><td className="nowrap">{formatDateTime(metric.collected_at)}</td><td>{formatMetric(metric.bandwidth_mbps, "Mbps")}</td><td>{formatMetric(metric.latency_ms, "ms")}</td><td>{formatMetric(metric.packet_loss_percent, "%")}</td><td>{formatMetric(metric.cpu_percent, "%")}</td><td>{formatMetric(metric.memory_percent, "%")}</td></tr>)}</tbody></table></div>
    </section>
  );
}

function WidgetSettings({ widgets, onChange, onReset, onClose }) {
  return (
    <div className="widget-settings">
      <p>Chọn các khối hiển thị trong tab Overview. Lựa chọn được lưu trên trình duyệt này.</p>
      <div className="widget-options">{Object.entries(WIDGET_LABELS).map(([key, label]) => <label className="widget-option" key={key}><input type="checkbox" checked={widgets[key]} onChange={(event) => onChange(key, event.target.checked)} /><span><strong>{label}</strong><small>{USE_MOCK_DATA ? "Dữ liệu mô phỏng được lưu trên trình duyệt" : key === "bandwidth" ? "Dữ liệu thật theo thiết bị đang chọn" : "Dữ liệu tổng hợp từ Backend hiện tại"}</small></span></label>)}</div>
      <div className="modal-actions"><button className="button button--secondary" type="button" onClick={onReset}>Khôi phục mặc định</button><button className="button button--primary" type="button" onClick={onClose}>Hoàn tất</button></div>
    </div>
  );
}

export default function TrafficMonitorPage() {
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [flowData, setFlowData] = useState(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [pointLimit, setPointLimit] = useState(60);
  const [activeTab, setActiveTab] = useState("overview");
  const [widgets, setWidgets] = useState(initialWidgets);
  const [customizing, setCustomizing] = useState(false);
  const [updatingAlertId, setUpdatingAlertId] = useState(null);
  const updatingAlertRef = useRef(null);
  const [actionError, setActionError] = useState("");
  const intervalMs = getRefreshInterval();

  useEffect(() => {
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(widgets));
  }, [widgets]);

  const polling = useAutoRefresh(async (signal) => {
    const [deviceData, alertData, summaryData, metricData, nextFlowData] = await Promise.all([
      deviceApi.list({ signal }),
      alertApi.list({ limit: 100, signal }),
      dashboardApi.getSummary({ signal }),
      selectedDeviceId ? metricApi.listByDevice({ deviceId: selectedDeviceId, limit: 120, signal }) : Promise.resolve(null),
      USE_MOCK_DATA ? trafficApi.getFlowData({ signal }) : Promise.resolve(null),
    ]);
    setDevices(deviceData);
    setAlerts(alertData);
    setSummary(summaryData);
    if (metricData) setMetrics(metricData);
    if (nextFlowData) setFlowData(nextFlowData);
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
  const chartData = useMemo(() => sortedMetrics.slice(-pointLimit), [pointLimit, sortedMetrics]);
  const latest = useMemo(() => newestMetric(metrics), [metrics]);
  const names = useMemo(() => deviceNameMap(devices), [devices]);
  const openAlerts = useMemo(() => alerts.filter((alert) => alert.status === "open"), [alerts]);
  const activeAlarms = useMemo(() => alerts.filter((alert) => alert.status !== "resolved"), [alerts]);
  const abnormalDevices = useMemo(() => devices.map((device) => {
    const relevant = openAlerts.filter((alert) => alert.device_id === device.id && ["warning", "critical"].includes(alert.level));
    relevant.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const highest = relevant.reduce((level, alert) => severityRank[alert.level] > severityRank[level || "info"] ? alert.level : level, relevant[0]?.level);
    return { ...device, relevant, highest, latestAlert: relevant[0] };
  }).filter((device) => device.status === "offline" || device.relevant.length), [devices, openAlerts]);
  const liveStatus = polling.paused ? "paused" : polling.error ? "disconnected" : isStale(latest?.collected_at || summary?.last_metric_at, intervalMs) ? "stale" : "live";
  const noInitialData = polling.error && !polling.lastSuccessAt && !devices.length;

  const updateAlertStatus = async (alert, status) => {
    if (updatingAlertRef.current) return;
    if (status === "resolved" && !window.confirm("Đánh dấu cảnh báo này là đã xử lý?")) return;
    updatingAlertRef.current = alert.id;
    setUpdatingAlertId(alert.id);
    setActionError("");
    try {
      const updated = await alertApi.updateStatus(alert.id, status);
      setAlerts((current) => current.map((item) => item.id === updated.id ? updated : item));
      await polling.refresh();
    } catch (error) {
      setActionError(error.message);
    } finally {
      updatingAlertRef.current = null;
      setUpdatingAlertId(null);
    }
  };

  const deviceControls = (
    <section className="monitor-controls panel">
      <div className="field"><label htmlFor="monitor-device">Thiết bị đang theo dõi</label><select id="monitor-device" value={selectedDeviceId} onChange={(event) => { setSelectedDeviceId(event.target.value); setMetrics([]); }}>{devices.map((device) => <option key={device.id} value={device.id}>{device.name} — {device.ip_address} — {statusText[device.status] || device.status}</option>)}</select></div>
      <div className="field"><label htmlFor="monitor-limit">Số điểm dữ liệu</label><select id="monitor-limit" value={pointLimit} onChange={(event) => setPointLimit(Number(event.target.value))}>{POINT_OPTIONS.map((limit) => <option key={limit} value={limit}>{limit} điểm</option>)}</select></div>
      <div className="selected-device-status"><span className="section-label">Trạng thái thiết bị</span><StatusBadge status={selectedDevice?.status} /></div>
    </section>
  );

  const renderOverview = () => {
    if (polling.isInitialLoading && !summary) return <LoadingState />;
    if (noInitialData) return <EmptyState title="Chưa thể tải dữ liệu Overview" description="Backend đang mất kết nối. Dashboard sẽ tự phục hồi khi dịch vụ hoạt động lại." />;
    if (!devices.length) return <EmptyState title="Chưa có thiết bị để giám sát" description="Thêm thiết bị để bắt đầu hiển thị dashboard lưu lượng." action={<Link className="button button--primary" to="/devices">Quản lý thiết bị</Link>} />;
    return (
      <div className="traffic-tab-content">
        {widgets.summary && <section className="kpi-grid kpi-grid--traffic-summary">
          {[["Tổng thiết bị", summary?.total_devices, "neutral"], ["Online", summary?.online_devices, "success"], ["Offline", summary?.offline_devices, "critical"], ["Unknown", summary?.unknown_devices, "muted"], ["Open alerts", summary?.open_alerts, "warning"], ["Critical alerts", summary?.critical_alerts, "critical"], ["Total metrics", summary?.total_metrics, "info"]].map(([label, value, tone]) => <article className={"kpi-card kpi-card--" + tone} key={label}><span>{label}</span><strong>{value ?? "—"}</strong></article>)}
          <article className="kpi-card kpi-card--wide"><span>Last metric time</span><strong className="kpi-card__date">{formatDateTime(summary?.last_metric_at)}</strong></article>
        </section>}
        {widgets.heatmap && <DeviceHealthHeatmap devices={devices} alerts={alerts} />}
        {widgets.bandwidth && <div className="overview-bandwidth-widget">{deviceControls}<MetricChart title="Bandwidth báo cáo" description={"Băng thông cấp thiết bị • " + (selectedDevice?.name || "Chưa chọn thiết bị")} data={chartData} lines={[{ dataKey: "bandwidth_mbps", name: "Bandwidth báo cáo", color: "var(--chart-green)" }]} unit="Mbps" /></div>}
        <div className="monitor-bottom-grid">
          {widgets.alarms && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Luồng sự kiện</p><h2>Cảnh báo gần đây</h2></div><button className="text-button" type="button" onClick={() => setActiveTab("alarms")}>Mở Alarms</button></div><RecentAlarms alerts={alerts} names={names} /></section>}
          {widgets.abnormal && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Ưu tiên xử lý</p><h2>Thiết bị bất thường</h2></div></div><AbnormalDevices devices={abnormalDevices} /></section>}
        </div>
        {!Object.values(widgets).some(Boolean) && <section className="panel"><EmptyState title="Dashboard đang ẩn toàn bộ widget" description="Mở Tùy chỉnh Dashboard để bật lại các khối thông tin." action={<button className="button button--primary" type="button" onClick={() => setCustomizing(true)}>Tùy chỉnh Dashboard</button>} /></section>}
      </div>
    );
  };

  const renderTraffic = () => {
    if (polling.isInitialLoading && !devices.length) return <LoadingState />;
    if (noInitialData) return <EmptyState title="Chưa thể tải dữ liệu traffic" description="Backend đang mất kết nối. Dữ liệu tốt gần nhất sẽ được giữ lại nếu đã tải thành công." />;
    if (!devices.length) return <EmptyState title="Chưa có thiết bị" description="Traffic tab cần ít nhất một thiết bị có metric." />;
    return <div className="traffic-tab-content">{deviceControls}<section className="kpi-grid kpi-grid--metrics"><article className="kpi-card"><span>Bandwidth báo cáo</span><strong>{formatMetric(latest?.bandwidth_mbps, "Mbps")}</strong></article><article className="kpi-card"><span>Latency gần nhất</span><strong>{formatMetric(latest?.latency_ms, "ms")}</strong></article><article className="kpi-card"><span>Packet loss gần nhất</span><strong>{formatMetric(latest?.packet_loss_percent, "%")}</strong></article><article className="kpi-card"><span>CPU gần nhất</span><strong>{formatMetric(latest?.cpu_percent, "%")}</strong></article><article className="kpi-card"><span>RAM gần nhất</span><strong>{formatMetric(latest?.memory_percent, "%")}</strong></article><article className="kpi-card kpi-card--wide"><span>Metric gần nhất</span><strong className="kpi-card__date">{formatDateTime(latest?.collected_at)}</strong></article></section><div className="charts-grid"><MetricChart title="Bandwidth báo cáo" description="Backend chưa tách inbound/outbound" data={chartData} lines={[{ dataKey: "bandwidth_mbps", name: "Bandwidth báo cáo", color: "var(--chart-green)" }]} unit="Mbps" /><MetricChart title="Latency" description="Độ trễ phản hồi" data={chartData} lines={[{ dataKey: "latency_ms", name: "Latency", color: "var(--chart-blue)" }]} unit="ms" threshold={100} /><MetricChart title="Packet loss" description="Tỷ lệ gói tin thất thoát" data={chartData} lines={[{ dataKey: "packet_loss_percent", name: "Packet loss", color: "var(--chart-orange)" }]} unit="%" domain={[0, 100]} threshold={20} /></div><TrafficStatsTable metrics={chartData} /><RawMetricsTable metrics={chartData} /></div>;
  };

  const renderAlarms = () => {
    if (polling.isInitialLoading && !alerts.length) return <LoadingState />;
    if (noInitialData) return <EmptyState title="Chưa thể tải alarms" description="Backend đang mất kết nối." />;
    if (!activeAlarms.length) return <EmptyState title="Không có alarm đang hoạt động" description="Không có cảnh báo open hoặc acknowledged cần xử lý." />;
    return <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Active alarms</p><h2>Cảnh báo cần xử lý</h2><p>{activeAlarms.length} cảnh báo chưa đóng.</p></div><Link to="/alerts">Mở trang Cảnh báo</Link></div><div className="table-wrap"><table><thead><tr><th>Thời gian</th><th>Thiết bị</th><th>Mức độ</th><th>Nội dung</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>{activeAlarms.map((alert) => <tr key={alert.id}><td className="nowrap">{formatDateTime(alert.created_at)}</td><td><strong>{names.get(alert.device_id) || "Thiết bị #" + alert.device_id}</strong></td><td><StatusBadge status={alert.level} /></td><td className="alert-message-cell">{alert.message}</td><td><StatusBadge status={alert.status} /></td><td><div className="table-actions">{alert.status === "open" && <button className="text-button" type="button" disabled={updatingAlertId === alert.id} onClick={() => updateAlertStatus(alert, "acknowledged")}>Xác nhận</button>}<button className="text-button text-button--success" type="button" disabled={updatingAlertId === alert.id} onClick={() => updateAlertStatus(alert, "resolved")}>Đã xử lý</button></div></td></tr>)}</tbody></table></div></section>;
  };

  const mockFlowTabs = flowData ? {
    application: <FlowDataTable type="application" rows={flowData.applications} />,
    source: <FlowDataTable type="source" rows={flowData.sources} />,
    destination: <FlowDataTable type="destination" rows={flowData.destinations} />,
    conversation: <FlowDataTable type="conversation" rows={flowData.conversations} />,
    interface: <FlowDataTable type="interface" rows={flowData.interfaces.filter((item) => item.device_id === Number(selectedDeviceId))} selectedDevice={selectedDevice} />,
  } : {};
  const realFlowTabs = {
    application: <FlowEmptyState title="Lưu lượng theo Application" description="Backend chưa cung cấp dữ liệu application/protocol flow. Cần bổ sung NetFlow/IPFIX hoặc traffic collector." columns={["Application", "Protocol", "Port", "Traffic", "Average speed", "% Traffic", "Show graph"]} />,
    source: <FlowEmptyState title="Nguồn lưu lượng" description="Backend chưa cung cấp source IP, packet count hoặc last seen." columns={["Source IP", "Traffic", "Average speed", "Packets", "Last seen", "Show graph"]} />,
    destination: <FlowEmptyState title="Đích lưu lượng" description="Backend chưa cung cấp destination IP, packet count hoặc last seen." columns={["Destination IP", "Traffic", "Average speed", "Packets", "Last seen", "Show graph"]} />,
    conversation: <FlowEmptyState title="Conversation" description="Backend chưa có dữ liệu hội thoại mạng giữa nguồn và đích." columns={["Source", "Destination", "Application", "Src Port", "Dest Port", "Protocol", "Traffic", "Average speed"]} />,
    interface: <FlowEmptyState title="Giám sát Interface" description="Backend chưa có interface_name, bandwidth_in, bandwidth_out, utilization hoặc errors." deviceNote={selectedDevice ? "Thiết bị " + selectedDevice.name + " hiện chỉ có bandwidth cấp thiết bị. Xem tab Traffic để theo dõi." : "Backend hiện chỉ hỗ trợ bandwidth cấp thiết bị."} columns={["Interface", "Status", "Inbound", "Outbound", "Utilization", "Errors", "Last updated"]} />,
  };
  const flowTabs = USE_MOCK_DATA ? mockFlowTabs : realFlowTabs;

  let tabContent;
  if (activeTab === "overview") tabContent = renderOverview();
  else if (activeTab === "traffic") tabContent = renderTraffic();
  else if (activeTab === "alarms") tabContent = renderAlarms();
  else tabContent = flowTabs[activeTab];

  return (
    <div className="page traffic-monitor-page">
      <PageHeader eyebrow="Cập nhật gần thời gian thực" title="Giám sát lưu lượng mạng" description="Theo dõi trạng thái, băng thông và cảnh báo thiết bị gần thời gian thực bằng REST polling." actions={<div className="page-header-action-group">{USE_MOCK_DATA && <DemoDataBadge />}<button className="button button--secondary" type="button" onClick={() => setCustomizing(true)}>Tùy chỉnh Dashboard</button></div>} />
      <LiveConnectionBadge status={liveStatus} lastUpdated={polling.lastSuccessAt} intervalMs={intervalMs} onToggle={polling.togglePaused} onRefresh={polling.refresh} refreshing={polling.isRefreshing} />
      {(polling.error || actionError) && <ErrorBanner message={actionError || polling.error.message} onRetry={polling.refresh} />}
      <TrafficTabs activeTab={activeTab} onChange={setActiveTab} />
      <div id={"traffic-panel-" + activeTab} role="tabpanel" aria-labelledby={"traffic-tab-" + activeTab}>{tabContent}</div>
      {customizing && <Modal title="Tùy chỉnh Dashboard" onClose={() => setCustomizing(false)}><WidgetSettings widgets={widgets} onChange={(key, checked) => setWidgets((current) => ({ ...current, [key]: checked }))} onReset={() => setWidgets(DEFAULT_WIDGETS)} onClose={() => setCustomizing(false)} /></Modal>}
    </div>
  );
}
