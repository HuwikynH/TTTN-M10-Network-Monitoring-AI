const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

function getErrorMessage(payload, fallbackMessage) {
  if (typeof payload?.detail === "string") return payload.detail;
  if (typeof payload?.message === "string") return payload.message;

  if (Array.isArray(payload?.detail)) {
    return payload.detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join("; ");
  }

  return fallbackMessage;
}

async function parseResponse(response) {
  if (response.status === 204) return null;

  const responseText = await response.text();
  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

export async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Không thể kết nối đến máy chủ. Hãy kiểm tra backend và thử lại.");
  }

  const payload = await parseResponse(response);

  if (!response.ok) {
    const error = new Error(
      getErrorMessage(payload, `Yêu cầu thất bại (HTTP ${response.status}).`),
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const deviceApi = {
  list: (options) => request("/devices", options),
  getById: (deviceId, options) => request(`/devices/${deviceId}`, options),
  create: (device, options = {}) =>
    request("/devices", { ...options, method: "POST", body: JSON.stringify(device) }),
  update: (deviceId, device, options = {}) =>
    request(`/devices/${deviceId}`, {
      ...options,
      method: "PUT",
      body: JSON.stringify(device),
    }),
  remove: (deviceId, options = {}) =>
    request(`/devices/${deviceId}`, { ...options, method: "DELETE" }),
};

export const metricApi = {
  list: ({ deviceId, limit = 100, signal } = {}) => {
    const query = new URLSearchParams();
    if (deviceId !== undefined && deviceId !== null) query.set("device_id", deviceId);
    query.set("limit", limit);
    return request(`/metrics?${query.toString()}`, { signal });
  },
};

export const alertApi = {
  list: ({ deviceId, status, signal } = {}) => {
    const query = new URLSearchParams();
    if (deviceId !== undefined && deviceId !== null) query.set("device_id", deviceId);
    if (status) query.set("status", status);
    const suffix = query.size ? `?${query.toString()}` : "";
    return request(`/alerts${suffix}`, { signal });
  },
};

export { API_URL };
