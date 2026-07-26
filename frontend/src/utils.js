export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
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
