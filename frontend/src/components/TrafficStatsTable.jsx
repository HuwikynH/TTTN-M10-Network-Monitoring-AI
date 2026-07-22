import { formatMetric } from "../utils";

const METRICS = [
  { key: "bandwidth_mbps", label: "Bandwidth báo cáo", unit: "Mbps" },
  { key: "latency_ms", label: "Latency", unit: "ms" },
  { key: "packet_loss_percent", label: "Packet loss", unit: "%" },
];

function calculate(values) {
  const numeric = values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter(Number.isFinite);
  if (!numeric.length) return null;
  const average = numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  const variance = numeric.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / numeric.length;
  return {
    latest: numeric[numeric.length - 1],
    max: Math.max(...numeric),
    min: Math.min(...numeric),
    average,
    standardDeviation: Math.sqrt(variance),
  };
}

export default function TrafficStatsTable({ metrics }) {
  const rows = METRICS.map((metric) => ({ ...metric, stats: calculate(metrics.map((item) => item[metric.key])) }));
  return (
    <section className="panel">
      <div className="panel-heading"><div><p className="eyebrow">Phân tích mẫu đo</p><h2>Thống kê lưu lượng</h2><p>Tính trên các điểm đang hiển thị trong trình duyệt.</p></div></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Chỉ số</th><th>Latest</th><th>Max</th><th>Min</th><th>Average</th><th>Độ lệch chuẩn</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.key}><td><strong>{row.label}</strong></td><td>{formatMetric(row.stats?.latest, row.unit)}</td><td>{formatMetric(row.stats?.max, row.unit)}</td><td>{formatMetric(row.stats?.min, row.unit)}</td><td>{formatMetric(row.stats?.average, row.unit)}</td><td>{formatMetric(row.stats?.standardDeviation, row.unit)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
