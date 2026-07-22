const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

function normalizeErrorDetail(payload) {
  if (!payload) return "Không thể xử lý yêu cầu.";
  if (typeof payload.detail === "string") return payload.detail;
  if (Array.isArray(payload.detail)) {
    return payload.detail
      .map((item) => item?.msg || item?.message || String(item))
      .filter(Boolean)
      .join("; ");
  }
  return payload.message || "Không thể xử lý yêu cầu.";
}

export async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    const networkError = new Error("Không thể kết nối Backend. Hãy kiểm tra dịch vụ tại cổng 8000.");
    networkError.cause = error;
    networkError.isNetworkError = true;
    throw networkError;
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(typeof payload === "string" && payload ? payload : normalizeErrorDetail(payload));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function queryString(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

export const dashboardApi = { getSummary: (options) => request("/dashboard/summary", options) };

export const deviceApi = {
  list: (options) => request("/devices", options),
  get: (deviceId, options) => request(`/devices/${deviceId}`, options),
  create: (payload, options = {}) => request("/devices", { ...options, method: "POST", body: JSON.stringify(payload) }),
  update: (deviceId, payload, options = {}) => request(`/devices/${deviceId}`, { ...options, method: "PUT", body: JSON.stringify(payload) }),
  remove: (deviceId, options = {}) => request(`/devices/${deviceId}`, { ...options, method: "DELETE" }),
};

export const metricApi = {
  list: ({ deviceId, skip = 0, limit = 120, signal } = {}) => request(`/metrics${queryString({ device_id: deviceId, skip, limit })}`, { signal }),
  get: (metricId, options) => request(`/metrics/${metricId}`, options),
  listByDevice: ({ deviceId, skip = 0, limit = 120, signal }) => request(`/devices/${deviceId}/metrics${queryString({ skip, limit })}`, { signal }),
};

export const alertApi = {
  list: ({ deviceId, status, skip = 0, limit = 100, signal } = {}) => request(`/alerts${queryString({ device_id: deviceId, status, skip, limit })}`, { signal }),
  get: (alertId, options) => request(`/alerts/${alertId}`, options),
  updateStatus: (alertId, status, options = {}) => request(`/alerts/${alertId}`, { ...options, method: "PATCH", body: JSON.stringify({ status }) }),
};

export { API_URL };
