import { createDefaultMockState, metricProfile, MOCK_STORAGE_KEYS, round, wave } from "./mockData.js";

const MOCK_DELAY_MS = 90;
const ADVANCE_INTERVAL_MS = 4_000;
let lastMetricAdvanceAt = Date.now();
let lastFlowAdvanceAt = Date.now();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.payload = { detail: message };
  return error;
}

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(MOCK_STORAGE_KEYS[key]));
  } catch {
    return null;
  }
}

function write(key, value) {
  localStorage.setItem(MOCK_STORAGE_KEYS[key], JSON.stringify(value));
}

function initialize() {
  const state = createDefaultMockState();
  Object.entries(state).forEach(([key, value]) => write(key, value));
  return state;
}

function ensureState() {
  const required = ["devices", "metrics", "alerts", "traffic", "aiResults", "meta"];
  const state = Object.fromEntries(required.map((key) => [key, read(key)]));
  return required.some((key) => state[key] === null) ? initialize() : state;
}

function delay(signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted.", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, MOCK_DELAY_MS);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    }, { once: true });
  });
}

function addRealtimeMetrics(state, now) {
  const tick = Number(state.meta.tick || 0) + 1;
  let nextId = state.metrics.reduce((max, metric) => Math.max(max, metric.id), 0) + 1;
  state.devices.filter((device) => device.status === "online").forEach((device) => {
    const profile = metricProfile(device.id);
    const spike = (tick + device.id * 3) % 37 === 0 ? 1 : 0;
    state.metrics.push({
      id: nextId++,
      device_id: device.id,
      latency_ms: round(Math.max(1, profile.latency + wave(device.id, tick, 8) + spike * 25)),
      packet_loss_percent: round(Math.max(0, 0.25 + wave(device.id + 2, tick, 0.65) + spike * 2.2)),
      cpu_percent: round(Math.min(98, profile.cpu + wave(device.id + 4, tick, 13) + spike * 10)),
      memory_percent: round(Math.min(98, profile.memory + wave(device.id + 8, tick, 7))),
      bandwidth_mbps: round(Math.max(0.5, profile.bandwidth + wave(device.id + 12, tick, 32) + spike * 42)),
      collected_at: new Date(now).toISOString(),
    });
  });
  const byDevice = new Map();
  state.metrics.sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at)).forEach((metric) => {
    const items = byDevice.get(metric.device_id) || [];
    if (items.length < 120) items.push(metric);
    byDevice.set(metric.device_id, items);
  });
  state.metrics = [...byDevice.values()].flat();
  state.meta = { ...state.meta, tick, last_advanced_at: new Date(now).toISOString() };
  write("metrics", state.metrics);
  write("meta", state.meta);
}

function advanceTraffic(state, now) {
  const tick = Number(state.meta.tick || 0);
  const updateFlow = (rows) => rows.map((row, index) => {
    const factor = 1 + wave(index + 1, tick, 0.025);
    const updated = { ...row };
    if ("average_bps" in updated) updated.average_bps = Math.max(0, Math.round(updated.average_bps * factor));
    if ("traffic_bytes" in updated) updated.traffic_bytes += Math.round((updated.average_bps || 0) * ADVANCE_INTERVAL_MS / 8_000);
    if ("last_seen" in updated) updated.last_seen = new Date(now - index * 2_000).toISOString();
    return updated;
  });
  state.traffic.applications = updateFlow(state.traffic.applications);
  state.traffic.sources = updateFlow(state.traffic.sources);
  state.traffic.destinations = updateFlow(state.traffic.destinations);
  state.traffic.conversations = updateFlow(state.traffic.conversations);
  state.traffic.interfaces = state.traffic.interfaces.map((item, index) => item.status === "up" ? {
    ...item,
    bandwidth_in_bps: Math.round(item.bandwidth_in_bps * (1 + wave(index + 2, tick, 0.02))),
    bandwidth_out_bps: Math.round(item.bandwidth_out_bps * (1 + wave(index + 5, tick, 0.02))),
    utilization_percent: round(Math.max(0, Math.min(100, item.utilization_percent + wave(index + 7, tick, 1.2))), 1),
    last_updated: new Date(now).toISOString(),
  } : item);
  write("traffic", state.traffic);
}

function currentState({ advanceMetrics = false, advanceFlow = false } = {}) {
  const state = ensureState();
  const now = Date.now();
  if (advanceMetrics && now - lastMetricAdvanceAt >= ADVANCE_INTERVAL_MS) {
    addRealtimeMetrics(state, now);
    lastMetricAdvanceAt = now;
  }
  if (advanceFlow && now - lastFlowAdvanceAt >= ADVANCE_INTERVAL_MS) {
    advanceTraffic(state, now);
    lastFlowAdvanceAt = now;
  }
  return state;
}

async function ready(signal, advances) {
  await delay(signal);
  return currentState(advances);
}

function paginate(items, skip = 0, limit = 100) {
  return items.slice(Math.max(0, Number(skip) || 0), Math.max(0, Number(skip) || 0) + Math.max(0, Number(limit) || 0));
}

export const mockDashboardApi = {
  async getSummary(options = {}) {
    const state = await ready(options.signal, { advanceMetrics: true });
    const devices = state.devices;
    const alerts = state.alerts;
    const lastMetric = state.metrics.reduce((latest, metric) => !latest || new Date(metric.collected_at) > new Date(latest.collected_at) ? metric : latest, null);
    return {
      total_devices: devices.length,
      online_devices: devices.filter((device) => device.status === "online").length,
      offline_devices: devices.filter((device) => device.status === "offline").length,
      unknown_devices: devices.filter((device) => device.status === "unknown").length,
      total_metrics: state.metrics.length,
      open_alerts: alerts.filter((alert) => alert.status === "open").length,
      critical_alerts: alerts.filter((alert) => alert.level === "critical" && alert.status === "open").length,
      last_metric_at: lastMetric?.collected_at || null,
    };
  },
};

export const mockDeviceApi = {
  async list(options = {}) {
    return clone((await ready(options.signal)).devices);
  },
  async get(deviceId, options = {}) {
    const device = (await ready(options.signal)).devices.find((item) => item.id === Number(deviceId));
    if (!device) throw createError("Không tìm thấy thiết bị.", 404);
    return clone(device);
  },
  async create(payload, options = {}) {
    const state = await ready(options.signal);
    if (state.devices.some((item) => item.ip_address === payload.ip_address)) throw createError("Địa chỉ IP đã tồn tại.", 409);
    const now = new Date().toISOString();
    const device = {
      id: state.devices.reduce((max, item) => Math.max(max, item.id), 0) + 1,
      name: String(payload.name || "").trim(),
      ip_address: String(payload.ip_address || "").trim(),
      location: payload.location?.trim() || null,
      status: payload.status || "unknown",
      created_at: now,
      updated_at: now,
    };
    if (!device.name || !device.ip_address) throw createError("Tên và địa chỉ IP là bắt buộc.", 422);
    state.devices.push(device);
    write("devices", state.devices);
    return clone(device);
  },
  async update(deviceId, payload, options = {}) {
    const state = await ready(options.signal);
    const index = state.devices.findIndex((item) => item.id === Number(deviceId));
    if (index < 0) throw createError("Không tìm thấy thiết bị.", 404);
    if (payload.ip_address && state.devices.some((item) => item.id !== Number(deviceId) && item.ip_address === payload.ip_address)) throw createError("Địa chỉ IP đã tồn tại.", 409);
    const allowed = ["name", "ip_address", "location", "status"];
    const changes = Object.fromEntries(Object.entries(payload).filter(([key, value]) => allowed.includes(key) && value !== undefined));
    state.devices[index] = { ...state.devices[index], ...changes, updated_at: new Date().toISOString() };
    write("devices", state.devices);
    return clone(state.devices[index]);
  },
  async remove(deviceId, options = {}) {
    const state = await ready(options.signal);
    const id = Number(deviceId);
    if (!state.devices.some((item) => item.id === id)) throw createError("Không tìm thấy thiết bị.", 404);
    write("devices", state.devices.filter((item) => item.id !== id));
    write("metrics", state.metrics.filter((item) => item.device_id !== id));
    write("alerts", state.alerts.filter((item) => item.device_id !== id));
    write("traffic", { ...state.traffic, interfaces: state.traffic.interfaces.filter((item) => item.device_id !== id) });
    return null;
  },
};

function sortNewest(items, field) {
  return [...items].sort((a, b) => new Date(b[field]) - new Date(a[field]));
}

export const mockMetricApi = {
  async list({ deviceId, skip = 0, limit = 120, signal } = {}) {
    let metrics = (await ready(signal, { advanceMetrics: true })).metrics;
    if (deviceId !== undefined && deviceId !== null && deviceId !== "") metrics = metrics.filter((item) => item.device_id === Number(deviceId));
    return clone(paginate(sortNewest(metrics, "collected_at"), skip, limit));
  },
  async get(metricId, options = {}) {
    const metric = (await ready(options.signal, { advanceMetrics: true })).metrics.find((item) => item.id === Number(metricId));
    if (!metric) throw createError("Không tìm thấy metric.", 404);
    return clone(metric);
  },
  async listByDevice({ deviceId, skip = 0, limit = 120, signal }) {
    const metrics = (await ready(signal, { advanceMetrics: true })).metrics.filter((item) => item.device_id === Number(deviceId));
    return clone(paginate(sortNewest(metrics, "collected_at"), skip, limit));
  },
};

export const mockAlertApi = {
  async list({ deviceId, status, skip = 0, limit = 100, signal } = {}) {
    let alerts = (await ready(signal)).alerts;
    if (deviceId !== undefined && deviceId !== null && deviceId !== "") alerts = alerts.filter((item) => item.device_id === Number(deviceId));
    if (status) alerts = alerts.filter((item) => item.status === status);
    return clone(paginate(sortNewest(alerts, "created_at"), skip, limit));
  },
  async get(alertId, options = {}) {
    const alert = (await ready(options.signal)).alerts.find((item) => item.id === Number(alertId));
    if (!alert) throw createError("Không tìm thấy cảnh báo.", 404);
    return clone(alert);
  },
  async updateStatus(alertId, status, options = {}) {
    if (!["open", "acknowledged", "resolved"].includes(status)) throw createError("Trạng thái cảnh báo không hợp lệ.", 422);
    const state = await ready(options.signal);
    const index = state.alerts.findIndex((item) => item.id === Number(alertId));
    if (index < 0) throw createError("Không tìm thấy cảnh báo.", 404);
    state.alerts[index] = { ...state.alerts[index], status };
    write("alerts", state.alerts);
    return clone(state.alerts[index]);
  },
};

export const mockTrafficApi = {
  async getFlowData(options = {}) {
    return clone((await ready(options.signal, { advanceFlow: true })).traffic);
  },
};

export const mockAiApi = {
  async list(options = {}) {
    return clone((await ready(options.signal)).aiResults);
  },
};

export function resetMockData() {
  Object.values(MOCK_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  lastMetricAdvanceAt = Date.now();
  lastFlowAdvanceAt = Date.now();
  initialize();
  window.dispatchEvent(new CustomEvent("network-monitoring:mock-reset"));
}
