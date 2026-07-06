import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { deviceApi, metricApi } from "../api/api";
import Loading from "../components/Loading";
import MetricChart from "../components/MetricChart";
import PageHeader from "../components/PageHeader";
import { EmptyState, ErrorMessage } from "../components/StateFeedback";
import StatusBadge from "../components/StatusBadge";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function formatMetric(value, unit) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${unit}`;
}

export default function DeviceDetailPage() {
  const { deviceId } = useParams();
  const numericDeviceId = Number(deviceId);
  const validDeviceId = Number.isInteger(numericDeviceId) && numericDeviceId > 0;
  const [device, setDevice] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const mountedRef = useRef(false);
  const controllerRef = useRef(null);

  const loadDeviceData = useCallback(async () => {
    if (!validDeviceId) {
      if (mountedRef.current) {
        setNotFound(true);
        setLoading(false);
      }
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    if (mountedRef.current) {
      setLoading(true);
      setError("");
      setNotFound(false);
    }

    try {
      const [deviceData, metricData] = await Promise.all([
        deviceApi.getById(numericDeviceId, { signal: controller.signal }),
        metricApi.list({ deviceId: numericDeviceId, limit: 1000, signal: controller.signal }),
      ]);

      if (!mountedRef.current) return;
      setDevice(deviceData);
      setMetrics(metricData || []);
    } catch (requestError) {
      if (requestError.name === "AbortError" || !mountedRef.current) return;
      if (requestError.status === 404) setNotFound(true);
      else setError(requestError.message);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (mountedRef.current) setLoading(false);
    }
  }, [numericDeviceId, validDeviceId]);

  useEffect(() => {
    mountedRef.current = true;
    loadDeviceData();
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, [loadDeviceData]);

  const latestMetric = useMemo(
    () =>
      [...metrics].sort(
        (first, second) => new Date(second.collected_at) - new Date(first.collected_at),
      )[0] || null,
    [metrics],
  );

  if (loading && !device) return <Loading message="Đang tải thông tin thiết bị..." />;

  if (notFound) {
    return (
      <section className="not-found panel">
        <span className="not-found__code">404</span>
        <h1>Không tìm thấy thiết bị</h1>
        <p>Thiết bị này không tồn tại hoặc đã bị xóa khỏi hệ thống.</p>
        <Link className="button button--primary" to="/devices">← Quay lại danh sách</Link>
      </section>
    );
  }

  if (error && !device) {
    return (
      <section className="not-found panel">
        <span className="not-found__icon">!</span>
        <h1>Không thể tải dữ liệu</h1>
        <p>{error}</p>
        <div className="form-actions form-actions--center">
          <Link className="button button--secondary" to="/devices">← Quay lại</Link>
          <button className="button button--primary" type="button" onClick={loadDeviceData}>Thử lại</button>
        </div>
      </section>
    );
  }

  if (!device) return null;

  return (
    <>
      <Link className="back-link" to="/devices">← Quay lại danh sách thiết bị</Link>
      <PageHeader
        eyebrow={`Chi tiết thiết bị #${device.id}`}
        description={`Cập nhật gần nhất: ${formatDateTime(device.updated_at)}`}
        detail
        actions={
          <button className="button button--secondary" type="button" onClick={loadDeviceData} disabled={loading}>
            ↻ {loading ? "Đang tải..." : "Tải lại"}
          </button>
        }
      >
          <div className="title-with-badge"><h1>{device.name}</h1><StatusBadge status={device.status} /></div>
      </PageHeader>

      <ErrorMessage message={error} onRetry={loadDeviceData} />

      <section className="device-overview-grid">
        <article className="info-card"><span>Địa chỉ IP</span><strong className="mono">{device.ip_address}</strong></article>
        <article className="info-card"><span>Vị trí</span><strong>{device.location || "Chưa cập nhật"}</strong></article>
        <article className="info-card"><span>Ngày thêm</span><strong>{formatDateTime(device.created_at)}</strong></article>
        <article className="info-card"><span>Metric gần nhất</span><strong>{latestMetric ? formatDateTime(latestMetric.collected_at) : "Chưa có"}</strong></article>
      </section>

      {latestMetric && (
        <section className="latest-metrics" aria-label="Chỉ số gần nhất">
          <article><span>Latency</span><strong>{formatMetric(latestMetric.latency_ms, "ms")}</strong></article>
          <article><span>Packet loss</span><strong>{formatMetric(latestMetric.packet_loss_percent, "%")}</strong></article>
          <article><span>CPU</span><strong>{formatMetric(latestMetric.cpu_percent, "%")}</strong></article>
          <article><span>RAM</span><strong>{formatMetric(latestMetric.memory_percent, "%")}</strong></article>
          <article><span>Bandwidth</span><strong>{formatMetric(latestMetric.bandwidth_mbps, "Mbps")}</strong></article>
        </section>
      )}

      {metrics.length === 0 ? (
        <EmptyState
          title="Thiết bị chưa có chỉ số"
          message="Dữ liệu biểu đồ sẽ xuất hiện sau khi collector gửi chỉ số về backend."
        />
      ) : (
        <section className="charts-grid">
          <MetricChart metrics={metrics} dataKey="latency_ms" title="Latency" unit="ms" color="var(--color-success)" />
          <MetricChart metrics={metrics} dataKey="packet_loss_percent" title="Packet loss" unit="%" color="var(--color-warning)" domain={[0, 100]} />
        </section>
      )}
    </>
  );
}
