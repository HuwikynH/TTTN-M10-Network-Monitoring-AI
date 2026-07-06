import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { alertApi, deviceApi } from "../api/api";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import { EmptyState, ErrorMessage } from "../components/StateFeedback";
import StatusBadge from "../components/StatusBadge";

const LEVEL_LABELS = { info: "Thông tin", warning: "Cảnh báo", critical: "Nghiêm trọng" };

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

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [levelFilter, setLevelFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mountedRef = useRef(false);
  const controllerRef = useRef(null);

  const loadAlerts = useCallback(async () => {
    const controller = new AbortController();
    controllerRef.current = controller;
    if (mountedRef.current) setLoading(true);

    try {
      const [alertData, deviceData] = await Promise.all([
        alertApi.list({ signal: controller.signal }),
        deviceApi.list({ signal: controller.signal }),
      ]);
      if (!mountedRef.current) return;
      setAlerts(alertData || []);
      setDevices(deviceData || []);
      setError("");
    } catch (requestError) {
      if (requestError.name !== "AbortError" && mountedRef.current) setError(requestError.message);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadAlerts();
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, [loadAlerts]);

  const deviceNames = useMemo(
    () => new Map(devices.map((device) => [device.id, device.name])),
    [devices],
  );

  const filteredAlerts = useMemo(
    () => alerts.filter((alert) => levelFilter === "all" || alert.level === levelFilter),
    [alerts, levelFilter],
  );

  return (
    <>
      <PageHeader
        eyebrow="Trung tâm cảnh báo"
        title="Danh sách cảnh báo"
        description="Theo dõi các sự kiện bất thường được ghi nhận từ thiết bị."
        actions={
          <button className="button button--secondary" type="button" onClick={loadAlerts} disabled={loading}>
            ↻ {loading ? "Đang tải..." : "Tải lại"}
          </button>
        }
      />

      <ErrorMessage message={error} onRetry={loadAlerts} />

      <section className="panel">
        <div className="panel-heading panel-heading--wrap">
          <div><p className="eyebrow">Nhật ký cảnh báo</p><h2>Cảnh báo hệ thống</h2></div>
          <div className="filter-group" role="group" aria-label="Lọc theo mức cảnh báo">
            {[
              ["all", "Tất cả"],
              ["info", "Thông tin"],
              ["warning", "Cảnh báo"],
              ["critical", "Nghiêm trọng"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={levelFilter === value ? "filter-button filter-button--active" : "filter-button"}
                type="button"
                onClick={() => setLevelFilter(value)}
                aria-pressed={levelFilter === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading && alerts.length === 0 ? (
          <Loading message="Đang tải danh sách cảnh báo..." />
        ) : alerts.length === 0 ? (
          <EmptyState title="Chưa có cảnh báo" message="Hệ thống chưa ghi nhận cảnh báo nào." />
        ) : filteredAlerts.length === 0 ? (
          <EmptyState message="Không có cảnh báo phù hợp với bộ lọc đã chọn." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Thời gian</th><th>Thiết bị</th><th>Mức độ</th><th>Nội dung</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {filteredAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="date-cell">{formatDateTime(alert.created_at)}</td>
                    <td><strong>{deviceNames.get(alert.device_id) || `Thiết bị #${alert.device_id}`}</strong></td>
                    <td><span className={`severity-badge severity-badge--${alert.level}`}>{LEVEL_LABELS[alert.level] || alert.level}</span></td>
                    <td className="message-cell">{alert.message}</td>
                    <td><StatusBadge status={alert.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
