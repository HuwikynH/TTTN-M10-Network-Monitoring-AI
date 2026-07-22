import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { deviceApi, metricApi } from "../api/api";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import LiveConnectionBadge from "../components/LiveConnectionBadge";
import LoadingState from "../components/LoadingState";
import MetricChart from "../components/MetricChart";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import useAutoRefresh, { getRefreshInterval } from "../hooks/useAutoRefresh";
import { formatDateTime, formatMetric, isStale, newestMetric, sortMetricsAscending } from "../utils";

export default function DeviceDetailPage() {
  const { deviceId } = useParams();
  const numericId = Number(deviceId);
  const [device, setDevice] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [notFound, setNotFound] = useState(!Number.isInteger(numericId) || numericId < 1);
  const intervalMs = getRefreshInterval();
  const polling = useAutoRefresh(async (signal) => {
    if (notFound) return;
    try {
      const [deviceData, metricData] = await Promise.all([deviceApi.get(numericId, { signal }), metricApi.listByDevice({ deviceId: numericId, limit: 120, signal })]);
      setDevice(deviceData);
      setMetrics(metricData);
    } catch (error) {
      if (error.status === 404) {
        setDevice(null);
        setMetrics([]);
        setNotFound(true);
        return;
      }
      throw error;
    }
  }, { intervalMs, enabled: !notFound });
  const chartData = useMemo(() => sortMetricsAscending(metrics).slice(-120), [metrics]);
  const latest = useMemo(() => newestMetric(metrics), [metrics]);
  const liveStatus = polling.paused ? "paused" : polling.error ? "disconnected" : polling.isRefreshing ? "refreshing" : isStale(latest?.collected_at, intervalMs) ? "stale" : "live";

  if (notFound) return <div className="page page--center"><EmptyState title="Không tìm thấy thiết bị" description="Thiết bị có thể đã bị xóa hoặc đường dẫn không hợp lệ." action={<Link className="button button--primary" to="/devices">Quay lại danh sách</Link>} /></div>;
  if (polling.isInitialLoading && !device) return <div className="page"><LoadingState /></div>;
  return (
    <div className="page">
      <PageHeader eyebrow="Chi tiết thiết bị" title={device?.name || "Thiết bị"} description={device ? device.ip_address + (device.location ? " • " + device.location : "") : "Đang lấy thông tin thiết bị"} actions={<Link className="button button--secondary" to="/devices">← Danh sách thiết bị</Link>} />
      <LiveConnectionBadge status={liveStatus} lastUpdated={polling.lastSuccessAt} intervalMs={intervalMs} onToggle={polling.togglePaused} onRefresh={polling.refresh} refreshing={polling.isRefreshing} />
      {polling.error && <ErrorBanner message={polling.error.message} onRetry={polling.refresh} />}
      {device && (
        <>
          <section className="device-overview panel">
            <div><span className="section-label">Trạng thái</span><StatusBadge status={device.status} /></div>
            <div><span className="section-label">Địa chỉ IP</span><strong className="mono">{device.ip_address}</strong></div>
            <div><span className="section-label">Vị trí</span><strong>{device.location || "—"}</strong></div>
            <div><span className="section-label">Metric gần nhất</span><strong>{formatDateTime(latest?.collected_at)}</strong></div>
          </section>
          <section className="kpi-grid kpi-grid--metrics">
            <article className="kpi-card"><span>Latency gần nhất</span><strong>{formatMetric(latest?.latency_ms, "ms")}</strong></article>
            <article className="kpi-card"><span>Packet loss gần nhất</span><strong>{formatMetric(latest?.packet_loss_percent, "%")}</strong></article>
            <article className="kpi-card"><span>CPU gần nhất</span><strong>{formatMetric(latest?.cpu_percent, "%")}</strong></article>
            <article className="kpi-card"><span>RAM gần nhất</span><strong>{formatMetric(latest?.memory_percent, "%")}</strong></article>
            <article className="kpi-card"><span>Bandwidth gần nhất</span><strong>{formatMetric(latest?.bandwidth_mbps, "Mbps")}</strong></article>
          </section>
          {!metrics.length ? <EmptyState title="Thiết bị chưa có metric" description="Biểu đồ sẽ được cập nhật khi Collector gửi dữ liệu." /> : (
            <div className="charts-grid">
              <MetricChart title="Latency" description="Độ trễ phản hồi của thiết bị" data={chartData} lines={[{ dataKey: "latency_ms", name: "Latency", color: "var(--chart-blue)" }]} unit="ms" threshold={100} />
              <MetricChart title="Packet loss" description="Tỷ lệ gói tin thất thoát" data={chartData} lines={[{ dataKey: "packet_loss_percent", name: "Packet loss", color: "var(--chart-orange)" }]} unit="%" domain={[0, 100]} threshold={20} />
              <MetricChart title="CPU" description="Mức sử dụng bộ xử lý" data={chartData} lines={[{ dataKey: "cpu_percent", name: "CPU", color: "var(--chart-purple)" }]} unit="%" domain={[0, 100]} threshold={90} />
              <MetricChart title="RAM" description="Mức sử dụng bộ nhớ" data={chartData} lines={[{ dataKey: "memory_percent", name: "RAM", color: "var(--chart-teal)" }]} unit="%" domain={[0, 100]} threshold={90} />
              <MetricChart title="Bandwidth" description="Băng thông báo cáo của thiết bị" data={chartData} lines={[{ dataKey: "bandwidth_mbps", name: "Bandwidth", color: "var(--chart-green)" }]} unit="Mbps" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
