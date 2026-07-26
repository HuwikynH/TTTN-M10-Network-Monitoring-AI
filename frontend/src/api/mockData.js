const MINUTE = 60_000;

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function wave(seed, index, amplitude = 1) {
  return (Math.sin(seed * 1.73 + index * 0.41) + Math.cos(seed * 0.37 + index * 0.19)) * amplitude / 2;
}

const DEVICE_BLUEPRINTS = [
  ["Core-Router-HCM", "10.10.0.1", "Data Center HCM", "online"],
  ["Core-Switch-DC", "10.10.0.2", "Data Center HCM", "online"],
  ["Edge-Router-DN", "10.20.0.1", "Chi nhánh Đà Nẵng", "online"],
  ["Firewall-HQ", "10.10.0.254", "Trụ sở chính", "online"],
  ["Access-Switch-F1", "10.10.11.2", "Tầng 1 - Trụ sở", "offline"],
  ["Access-Switch-F2", "10.10.12.2", "Tầng 2 - Trụ sở", "online"],
  ["Wifi-Controller", "10.10.20.5", "Trụ sở chính", "online"],
  ["Server-DB-01", "10.10.30.10", "Server Room", "offline"],
  ["Server-Web-01", "10.10.30.20", "DMZ", "online"],
  ["Branch-Router-HN", "10.30.0.1", "Chi nhánh Hà Nội", "online"],
  ["Branch-Router-CT", "10.40.0.1", "Chi nhánh Cần Thơ", "unknown"],
  ["VPN-Gateway", "10.10.0.250", "DMZ", "online"],
  ["Load-Balancer-01", "10.10.30.5", "DMZ", "online"],
  ["Backup-NAS", "10.10.31.15", "Server Room", "unknown"],
];

function buildDevices(now) {
  return DEVICE_BLUEPRINTS.map(([name, ip_address, location, status], index) => ({
    id: index + 1,
    name,
    ip_address,
    location,
    status,
    created_at: new Date(now - (50 - index) * 86_400_000).toISOString(),
    updated_at: new Date(now - (status === "online" ? index * 45_000 : (index + 3) * 12 * MINUTE)).toISOString(),
  }));
}

function metricProfile(deviceId) {
  return {
    bandwidth: 35 + (deviceId * 17) % 160,
    latency: 5 + (deviceId * 7) % 42,
    cpu: 22 + (deviceId * 11) % 38,
    memory: 35 + (deviceId * 9) % 35,
  };
}

function buildMetrics(devices, now) {
  let id = 1;
  const metrics = [];
  devices.forEach((device) => {
    const count = 72 + (device.id % 5) * 6;
    const profile = metricProfile(device.id);
    const staleOffset = device.status === "online" ? 0 : device.status === "offline" ? 35 * MINUTE : 180 * MINUTE;
    for (let index = count - 1; index >= 0; index -= 1) {
      const spike = index % 29 === 0 ? 1 : 0;
      metrics.push({
        id: id++,
        device_id: device.id,
        latency_ms: round(Math.max(1, profile.latency + wave(device.id, index, 9) + spike * 28)),
        packet_loss_percent: round(Math.max(0, Math.min(100, 0.25 + wave(device.id + 2, index, 0.7) + spike * 2.4))),
        cpu_percent: round(Math.max(2, Math.min(98, profile.cpu + wave(device.id + 4, index, 14) + spike * 12))),
        memory_percent: round(Math.max(5, Math.min(98, profile.memory + wave(device.id + 8, index, 8)))),
        bandwidth_mbps: round(Math.max(0.5, profile.bandwidth + wave(device.id + 12, index, 34) + spike * 45)),
        collected_at: new Date(now - staleOffset - index * MINUTE).toISOString(),
      });
    }
  });
  return metrics;
}

const ALERT_BLUEPRINTS = [
  [5, "critical", "Mất kết nối tới Access-Switch-F1", "open", 9],
  [8, "critical", "Server-DB-01 không phản hồi kiểm tra sức khỏe", "open", 14],
  [1, "warning", "Latency đường uplink tăng cao hơn ngưỡng", "acknowledged", 22],
  [9, "warning", "CPU sử dụng vượt 80% trong 5 phút", "open", 31],
  [4, "critical", "Phát hiện packet loss bất thường tại Firewall-HQ", "acknowledged", 46],
  [10, "warning", "Băng thông WAN đạt 85% công suất", "open", 63],
  [7, "info", "Wifi-Controller đã đồng bộ cấu hình", "resolved", 80],
  [12, "warning", "Số phiên VPN đồng thời tăng nhanh", "open", 102],
  [2, "info", "Core-Switch-DC hoàn tất backup cấu hình", "resolved", 130],
  [6, "warning", "Nhiệt độ thiết bị cao hơn mức bình thường", "acknowledged", 175],
  [13, "warning", "Load-Balancer-01 có backend phản hồi chậm", "open", 220],
  [3, "critical", "Uplink ISP dự phòng gián đoạn ngắn", "resolved", 280],
  [1, "info", "BGP session đã được khôi phục", "resolved", 340],
  [9, "critical", "Packet loss tới Server-Web-01 vượt 10%", "resolved", 410],
  [10, "info", "Branch-Router-HN khởi động lại thành công", "resolved", 520],
  [4, "warning", "Số kết nối bị chặn tăng đột biến", "resolved", 610],
  [12, "info", "Chứng thư VPN còn 30 ngày hết hạn", "acknowledged", 720],
  [2, "warning", "Một cổng trunk có nhiều lỗi CRC", "resolved", 880],
  [6, "info", "Access-Switch-F2 cập nhật firmware thành công", "resolved", 1050],
  [13, "critical", "Một pool ứng dụng không còn healthy node", "resolved", 1260],
  [7, "warning", "Mật độ client Wi-Fi cao tại tầng 2", "resolved", 1480],
  [3, "info", "Đường truyền ISP chính hoạt động ổn định", "resolved", 1760],
];

function buildAlerts(now) {
  return ALERT_BLUEPRINTS.map(([device_id, level, message, status, minutesAgo], index) => ({
    id: index + 1,
    device_id,
    level,
    message,
    status,
    created_at: new Date(now - minutesAgo * MINUTE).toISOString(),
  }));
}

function buildTraffic(devices, now) {
  const applications = [
    ["HTTPS", "TCP", 443, 6_840_000_000, 18_400_000, 34.2],
    ["Microsoft 365", "TCP", 443, 3_920_000_000, 11_250_000, 19.6],
    ["DNS", "UDP", 53, 1_460_000_000, 3_800_000, 7.3],
    ["SSH", "TCP", 22, 980_000_000, 2_450_000, 4.9],
    ["MySQL", "TCP", 3306, 2_360_000_000, 6_200_000, 11.8],
    ["HTTP", "TCP", 80, 1_620_000_000, 4_600_000, 8.1],
    ["IPsec VPN", "UDP", 4500, 1_180_000_000, 3_350_000, 5.9],
    ["SNMP", "UDP", 161, 510_000_000, 1_120_000, 2.6],
    ["NTP", "UDP", 123, 230_000_000, 520_000, 1.2],
    ["Other", "Mixed", 0, 880_000_000, 2_100_000, 4.4],
  ].map(([application, protocol, port, traffic_bytes, average_bps, traffic_percent], index) => ({ id: index + 1, application, protocol, port, traffic_bytes, average_bps, traffic_percent }));

  const sourceIps = ["10.10.30.20", "10.10.0.1", "10.30.0.1", "10.10.20.5", "10.20.0.1", "10.10.30.10", "10.10.12.2", "10.10.0.250", "10.10.30.5", "172.16.8.24"];
  const destinationIps = ["8.8.8.8", "1.1.1.1", "10.10.30.10", "13.107.42.14", "10.10.30.20", "52.96.84.34", "10.10.0.254", "142.250.66.78", "10.30.0.1", "10.20.0.1"];
  const sources = sourceIps.map((source_ip, index) => ({ id: index + 1, source_ip, traffic_bytes: 4_200_000_000 - index * 310_000_000, average_bps: 12_800_000 - index * 830_000, packets: 3_420_000 - index * 217_000, last_seen: new Date(now - index * 19_000).toISOString() }));
  const destinations = destinationIps.map((destination_ip, index) => ({ id: index + 1, destination_ip, traffic_bytes: 3_760_000_000 - index * 275_000_000, average_bps: 10_900_000 - index * 710_000, packets: 2_940_000 - index * 181_000, last_seen: new Date(now - index * 23_000).toISOString() }));
  const conversations = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    source: sourceIps[index % sourceIps.length],
    destination: destinationIps[(index * 3) % destinationIps.length],
    application: applications[index % applications.length].application,
    source_port: 49152 + index * 137,
    destination_port: applications[index % applications.length].port,
    protocol: applications[index % applications.length].protocol,
    traffic_bytes: 2_180_000_000 - index * 137_000_000,
    average_bps: 7_600_000 - index * 420_000,
  }));
  const interfaces = devices.flatMap((device) => [0, 1].map((position) => ({
    id: device.id * 10 + position,
    device_id: device.id,
    interface_name: position === 0 ? (device.name.includes("Server") ? "eth0" : "GigabitEthernet0/0") : (device.name.includes("Server") ? "eth1" : "GigabitEthernet0/1"),
    status: device.status === "online" ? (position === 0 ? "up" : "up") : device.status === "offline" ? "down" : "unknown",
    bandwidth_in_bps: device.status === "online" ? 7_500_000 + device.id * 630_000 + position * 1_300_000 : 0,
    bandwidth_out_bps: device.status === "online" ? 5_200_000 + device.id * 470_000 + position * 980_000 : 0,
    utilization_percent: device.status === "online" ? round(18 + device.id * 2.7 + position * 8.2, 1) : 0,
    errors: device.status === "online" ? (device.id + position) % 4 : device.status === "offline" ? 18 + device.id : 0,
    last_updated: new Date(now - device.id * 8_000).toISOString(),
  })));
  return { applications, sources, destinations, conversations, interfaces };
}

export const MOCK_STORAGE_KEYS = {
  devices: "network-monitoring-mock-devices-v1",
  metrics: "network-monitoring-mock-metrics-v1",
  alerts: "network-monitoring-mock-alerts-v1",
  traffic: "network-monitoring-mock-traffic-v1",
  aiResults: "network-monitoring-mock-ai-results-v1",
  meta: "network-monitoring-mock-meta-v1",
};

export function createDefaultMockState(now = Date.now()) {
  const devices = buildDevices(now);
  return {
    devices,
    metrics: buildMetrics(devices, now),
    alerts: buildAlerts(now),
    traffic: buildTraffic(devices, now),
    aiResults: [
      { id: 1, device_id: 5, score: 0.96, label: "connection_loss", explanation: "Thiết bị mất kết nối và không phát sinh metric mới.", created_at: new Date(now - 9 * MINUTE).toISOString() },
      { id: 2, device_id: 9, score: 0.87, label: "resource_pressure", explanation: "CPU và packet loss đồng thời tăng cao.", created_at: new Date(now - 31 * MINUTE).toISOString() },
      { id: 3, device_id: 10, score: 0.79, label: "bandwidth_saturation", explanation: "Băng thông WAN tiến gần ngưỡng công suất.", created_at: new Date(now - 63 * MINUTE).toISOString() },
    ],
    meta: { version: 1, tick: 0, generated_at: new Date(now).toISOString(), last_advanced_at: new Date(now).toISOString() },
  };
}

export { metricProfile, round, wave };
