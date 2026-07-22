import DemoDataBadge from "./DemoDataBadge";
import EmptyState from "./EmptyState";
import { formatDateTime } from "../utils";

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = bytes;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return amount.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " " + units[unit];
}

function formatSpeed(value) {
  const bps = Number(value);
  if (!Number.isFinite(bps)) return "—";
  if (bps >= 1_000_000_000) return (bps / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " Gbps";
  if (bps >= 1_000_000) return (bps / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " Mbps";
  if (bps >= 1_000) return (bps / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " Kbps";
  return bps.toLocaleString("vi-VN") + " bps";
}

const TABLES = {
  application: {
    title: "Lưu lượng theo Application",
    description: "Phân bổ lưu lượng mô phỏng theo ứng dụng và giao thức mạng.",
    columns: ["Application", "Protocol", "Port", "Traffic", "Average speed", "% Traffic", "Show graph"],
    cells: (row) => [<strong>{row.application}</strong>, row.protocol, row.port || "—", formatBytes(row.traffic_bytes), formatSpeed(row.average_bps), row.traffic_percent.toLocaleString("vi-VN") + "%", <span className="flow-graph-indicator" title="Chuỗi thời gian mô phỏng đang hoạt động">▰▰▰</span>],
  },
  source: {
    title: "Nguồn lưu lượng",
    description: "Các địa chỉ nguồn phát sinh nhiều lưu lượng nhất trong cửa sổ demo.",
    columns: ["Source IP", "Traffic", "Average speed", "Packets", "Last seen", "Show graph"],
    cells: (row) => [<strong className="mono">{row.source_ip}</strong>, formatBytes(row.traffic_bytes), formatSpeed(row.average_bps), row.packets.toLocaleString("vi-VN"), formatDateTime(row.last_seen), <span className="flow-graph-indicator">▰▰▰</span>],
  },
  destination: {
    title: "Đích lưu lượng",
    description: "Các địa chỉ đích nhận nhiều lưu lượng nhất trong cửa sổ demo.",
    columns: ["Destination IP", "Traffic", "Average speed", "Packets", "Last seen", "Show graph"],
    cells: (row) => [<strong className="mono">{row.destination_ip}</strong>, formatBytes(row.traffic_bytes), formatSpeed(row.average_bps), row.packets.toLocaleString("vi-VN"), formatDateTime(row.last_seen), <span className="flow-graph-indicator">▰▰▰</span>],
  },
  conversation: {
    title: "Conversation",
    description: "Các cặp nguồn–đích đang trao đổi nhiều dữ liệu nhất.",
    columns: ["Source", "Destination", "Application", "Src Port", "Dest Port", "Protocol", "Traffic", "Average speed"],
    cells: (row) => [<span className="mono">{row.source}</span>, <span className="mono">{row.destination}</span>, <strong>{row.application}</strong>, row.source_port, row.destination_port || "—", row.protocol, formatBytes(row.traffic_bytes), formatSpeed(row.average_bps)],
  },
  interface: {
    title: "Giám sát Interface",
    description: "Trạng thái và mức sử dụng interface của thiết bị đang chọn.",
    columns: ["Interface", "Status", "Inbound", "Outbound", "Utilization", "Errors", "Last updated"],
    cells: (row) => [<strong>{row.interface_name}</strong>, <span className={"interface-state interface-state--" + row.status}>{row.status}</span>, formatSpeed(row.bandwidth_in_bps), formatSpeed(row.bandwidth_out_bps), row.utilization_percent.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "%", row.errors.toLocaleString("vi-VN"), formatDateTime(row.last_updated)],
  },
};

export default function FlowDataTable({ type, rows = [], selectedDevice }) {
  const config = TABLES[type];
  if (!config) return null;
  if (!rows.length) return <EmptyState title="Chưa có dữ liệu mô phỏng" description="Không tìm thấy bản ghi phù hợp cho lựa chọn hiện tại." />;
  return (
    <section className="panel flow-data-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Flow analytics</p><h2>{config.title}</h2><p>{config.description}{type === "interface" && selectedDevice ? " Thiết bị: " + selectedDevice.name + "." : ""}</p></div>
        <DemoDataBadge />
      </div>
      <div className="table-wrap"><table><thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{config.cells(row).map((cell, index) => <td key={config.columns[index]}>{cell}</td>)}</tr>)}</tbody></table></div>
    </section>
  );
}
