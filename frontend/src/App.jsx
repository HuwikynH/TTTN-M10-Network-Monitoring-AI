import { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function StatusBadge({ status }) {
  return <span className={`status status--${status}`}>{status}</span>;
}

export default function App() {
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [deviceResponse, alertResponse] = await Promise.all([
          fetch(`${API_URL}/devices`),
          fetch(`${API_URL}/alerts`),
        ]);
        if (!deviceResponse.ok || !alertResponse.ok) throw new Error("API chưa sẵn sàng");
        setDevices(await deviceResponse.json());
        setAlerts(await alertResponse.json());
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const summary = useMemo(
    () => ({
      total: devices.length,
      online: devices.filter((device) => device.status === "online").length,
      offline: devices.filter((device) => device.status === "offline").length,
      alerts: alerts.filter((alert) => alert.status === "open").length,
    }),
    [devices, alerts],
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">NM</div>
        <div>
          <strong>Network Monitor</strong>
          <small>TTTN M10</small>
        </div>
        <nav>
          <a className="active" href="#dashboard">Tổng quan</a>
          <a href="#devices">Thiết bị</a>
          <a href="#alerts">Cảnh báo</a>
        </nav>
      </aside>

      <main>
        <header>
          <div>
            <p className="eyebrow">Hệ thống giám sát</p>
            <h1>Network Operations</h1>
          </div>
          <span className="environment">Sprint 1</span>
        </header>

        <section className="summary-grid" id="dashboard">
          <article><span>Tổng thiết bị</span><strong>{summary.total}</strong></article>
          <article><span>Đang online</span><strong className="green">{summary.online}</strong></article>
          <article><span>Đang offline</span><strong className="red">{summary.offline}</strong></article>
          <article><span>Cảnh báo mở</span><strong className="amber">{summary.alerts}</strong></article>
        </section>

        <section className="panel" id="devices">
          <div className="panel-heading">
            <div><p className="eyebrow">Inventory</p><h2>Thiết bị mạng</h2></div>
            <button type="button">+ Thêm thiết bị</button>
          </div>

          {loading && <p className="empty-state">Đang tải dữ liệu…</p>}
          {error && <p className="error-state">{error}. Hãy chạy Backend tại cổng 8000.</p>}
          {!loading && !error && devices.length === 0 && (
            <p className="empty-state">Chưa có thiết bị. Tạo thiết bị đầu tiên bằng Swagger.</p>
          )}
          {devices.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tên</th><th>Địa chỉ IP</th><th>Vị trí</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id}>
                      <td><strong>{device.name}</strong></td>
                      <td className="mono">{device.ip_address}</td>
                      <td>{device.location || "—"}</td>
                      <td><StatusBadge status={device.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
