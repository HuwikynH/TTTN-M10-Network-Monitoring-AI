export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
}

export function formatRelativeTime(value) {
  if (!value) return "Chưa có dữ liệu";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Chưa có dữ liệu";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "Vừa xong";
  if (seconds < 60) return `${seconds} giây trước`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

export function formatMetric(value, unit) {
  const numeric = Number(value);
  return value === null || value === undefined || !Number.isFinite(numeric)
    ? "—"
    : numeric.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + (unit ? " " + unit : "");
}

export function sortMetricsAscending(metrics) {
  return [...metrics].sort((a, b) => new Date(a.collected_at) - new Date(b.collected_at));
}

export function newestMetric(metrics) {
  return metrics.reduce((latest, metric) => !latest || new Date(metric.collected_at) > new Date(latest.collected_at) ? metric : latest, null);
}

export function isStale(value, intervalMs, minimumMs = 15000) {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return !Number.isFinite(timestamp) || Date.now() - timestamp > Math.max(intervalMs * 2, minimumMs);
}

export function deviceNameMap(devices) {
  return new Map(devices.map((device) => [device.id, device.name]));
}

const severityRank = { info: 1, warning: 2, critical: 3 };

export function activeAlerts(alerts) {
  return alerts.filter((alert) => alert.status !== "resolved");
}

export function highestAlertLevel(alerts) {
  return alerts.reduce(
    (highest, alert) => (severityRank[alert.level] || 0) > (severityRank[highest] || 0) ? alert.level : highest,
    null,
  );
}

export function alertCategory(message = "") {
  const normalized = message.toLocaleLowerCase("vi-VN");
  if (normalized.includes("mất kết nối")) return "Mất kết nối";
  if (normalized.includes("packet loss")) return "Packet loss cao";
  if (normalized.includes("latency")) return "Latency cao";
  if (normalized.includes("cpu")) return "CPU cao";
  if (normalized.includes("bộ nhớ") || normalized.includes("memory") || normalized.includes("ram")) return "RAM cao";
  if (normalized.includes("bandwidth") || normalized.includes("băng thông")) return "Băng thông cao";
  return message.replace(/\d+(?:[.,]\d+)?\s*(?:%|ms|mbps)?/gi, "#").trim();
}

export function groupAlerts(alerts) {
  const groups = new Map();
  alerts.forEach((alert) => {
    const category = alertCategory(alert.message);
    const key = [alert.device_id, alert.level, alert.status, category].join("|");
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        id: key,
        category,
        device_id: alert.device_id,
        level: alert.level,
        status: alert.status,
        alerts: [alert],
        latest: alert,
      });
      return;
    }
    current.alerts.push(alert);
    if (new Date(alert.created_at) > new Date(current.latest.created_at)) current.latest = alert;
  });
  return [...groups.values()].sort((a, b) => {
    const activeDifference = Number(b.status !== "resolved") - Number(a.status !== "resolved");
    if (activeDifference) return activeDifference;
    const severityDifference = (severityRank[b.level] || 0) - (severityRank[a.level] || 0);
    if (severityDifference) return severityDifference;
    return new Date(b.latest.created_at) - new Date(a.latest.created_at);
  });
}
