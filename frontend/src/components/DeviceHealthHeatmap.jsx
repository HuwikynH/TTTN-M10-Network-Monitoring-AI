import { Link } from "react-router-dom";

function healthTone(device, alerts) {
  const deviceAlerts = alerts.filter((alert) => alert.device_id === device.id && alert.status === "open");
  if (deviceAlerts.some((alert) => alert.level === "critical")) return "critical";
  if (deviceAlerts.some((alert) => alert.level === "warning")) return "warning";
  return device.status === "online" ? "online" : device.status === "offline" ? "offline" : "unknown";
}

const labels = {
  online: "Online",
  offline: "Offline",
  unknown: "Chưa xác định",
  warning: "Có cảnh báo",
  critical: "Cảnh báo nghiêm trọng",
};

export default function DeviceHealthHeatmap({ devices, alerts }) {
  return (
    <section className="panel health-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Device health</p><h2>Bản đồ sức khỏe thiết bị</h2><p>Màu thể hiện trạng thái hoặc cảnh báo đang mở cao nhất.</p></div>
        <div className="heatmap-legend" aria-label="Chú giải trạng thái">
          <span className="heatmap-legend__item heatmap-legend__item--online">Online</span>
          <span className="heatmap-legend__item heatmap-legend__item--warning">Warning</span>
          <span className="heatmap-legend__item heatmap-legend__item--critical">Critical</span>
        </div>
      </div>
      {devices.length ? (
        <div className="health-grid">
          {devices.map((device) => {
            const tone = healthTone(device, alerts);
            return (
              <Link className={"health-tile health-tile--" + tone} to={"/devices/" + device.id} key={device.id} title={device.name + " — " + labels[tone]}>
                <span className="health-tile__dot" aria-hidden="true" />
                <strong>{device.name}</strong>
                <span className="mono">{device.ip_address}</span>
                <small>{labels[tone]}</small>
              </Link>
            );
          })}
        </div>
      ) : <div className="heatmap-empty">Chưa có thiết bị để hiển thị.</div>}
    </section>
  );
}
