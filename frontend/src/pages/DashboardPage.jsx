import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { alertApi, deviceApi } from "../api/api";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import { EmptyState, ErrorMessage } from "../components/StateFeedback";
import StatusBadge from "../components/StatusBadge";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function DashboardPage() {
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const mountedRef = useRef(false);
  const controllersRef = useRef(new Set());

  const loadDashboard = useCallback(async ({ showLoading = false } = {}) => {
    const controller = new AbortController();
    controllersRef.current.add(controller);
    if (showLoading && mountedRef.current) setLoading(true);

    try {
      const [deviceData, alertData] = await Promise.all([
        deviceApi.list({ signal: controller.signal }),
        alertApi.list({ signal: controller.signal }),
      ]);

      if (!mountedRef.current) return;
      setDevices(deviceData || []);
      setAlerts(alertData || []);
      setError("");
      setLastUpdated(new Date());
    } catch (requestError) {
      if (requestError.name !== "AbortError" && mountedRef.current) {
        setError(requestError.message);
      }
    } finally {
      controllersRef.current.delete(controller);
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadDashboard({ showLoading: true });
    const refreshInterval = window.setInterval(() => loadDashboard(), 10_000);

    return () => {
      mountedRef.current = false;
      window.clearInterval(refreshInterval);
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
    };
  }, [loadDashboard]);

  const summary = useMemo(
    () => ({
      total: devices.length,
      online: devices.filter((device) => device.status === "online").length,
      offline: devices.filter((device) => device.status === "offline").length,
      unknown: devices.filter((device) => device.status === "unknown").length,
      openAlerts: alerts.filter((alert) => alert.status === "open").length,
    }),
    [alerts, devices],
  );

  const recentDevices = useMemo(
    () =>
      [...devices]
        .sort((first, second) => new Date(second.updated_at) - new Date(first.updated_at))
        .slice(0, 5),
    [devices],
  );

  const recentAlerts = useMemo(
    () =>
      [...alerts]
        .sort((first, second) => new Date(second.created_at) - new Date(first.created_at))
        .slice(0, 5),
    [alerts],
  );

  const deviceNames = useMemo(
    () => new Map(devices.map((device) => [device.id, device.name])),
    [devices],
  );

  return (
    <>
      <PageHeader
        eyebrow="Trung tâm vận hành mạng"
        title="Tổng quan hệ thống"
        description="Theo dõi nhanh trạng thái thiết bị và cảnh báo toàn hệ thống."
        actions={
          <>
          <span className="last-updated">
            Cập nhật: {lastUpdated ? formatDateTime(lastUpdated) : "Chưa có dữ liệu"}
          </span>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => loadDashboard({ showLoading: devices.length === 0 && alerts.length === 0 })}
            disabled={loading}
          >
            ↻ Tải lại
          </button>
          </>
        }
      />

      <ErrorMessage message={error} onRetry={() => loadDashboard({ showLoading: true })} />

      {loading && devices.length === 0 && alerts.length === 0 ? (
        <Loading message="Đang tải dữ liệu tổng quan..." />
      ) : (
        <>
          <section className="summary-grid" aria-label="Thống kê hệ thống">
            <StatCard label="Tổng thiết bị" value={summary.total} description="Trong hệ thống" symbol="▦" />
            <StatCard label="Online" value={summary.online} description="Đang hoạt động" variant="online" symbol="●" />
            <StatCard label="Offline" value={summary.offline} description="Cần kiểm tra" variant="offline" symbol="●" />
            <StatCard label="Chưa xác định" value={summary.unknown} description="Chưa có trạng thái" variant="unknown" symbol="?" />
            <StatCard label="Cảnh báo đang mở" value={summary.openAlerts} description="Chưa xử lý" variant="alert" symbol="!" />
          </section>

          <section className="dashboard-grid">
            <article className="panel">
              <div className="panel-heading">
                <div><p className="eyebrow">Thiết bị</p><h2>Trạng thái gần đây</h2></div>
                <Link className="text-link" to="/devices">Xem tất cả →</Link>
              </div>

              {recentDevices.length === 0 ? (
                <EmptyState message="Chưa có thiết bị trong hệ thống." />
              ) : (
                <div className="list-stack">
                  {recentDevices.map((device) => (
                    <Link className="device-list-item" to={`/devices/${device.id}`} key={device.id}>
                      <div className="device-avatar" aria-hidden="true">{device.name.slice(0, 2).toUpperCase()}</div>
                      <div className="list-item__content">
                        <strong>{device.name}</strong>
                        <span>{device.ip_address} · {device.location || "Chưa có vị trí"}</span>
                      </div>
                      <StatusBadge status={device.status} />
                    </Link>
                  ))}
                </div>
              )}
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div><p className="eyebrow">Cảnh báo</p><h2>Sự kiện gần đây</h2></div>
                <Link className="text-link" to="/alerts">Xem tất cả →</Link>
              </div>

              {recentAlerts.length === 0 ? (
                <EmptyState message="Chưa có cảnh báo nào được ghi nhận." />
              ) : (
                <div className="list-stack">
                  {recentAlerts.map((alert) => (
                    <div className="alert-list-item" key={alert.id}>
                      <span className={`severity-mark severity-mark--${alert.level}`} aria-hidden="true" />
                      <div className="list-item__content">
                        <strong>{deviceNames.get(alert.device_id) || `Thiết bị #${alert.device_id}`}</strong>
                        <span className="truncate">{alert.message}</span>
                      </div>
                      <time>{formatDateTime(alert.created_at)}</time>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </>
  );
}
