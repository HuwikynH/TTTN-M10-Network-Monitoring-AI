import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import EmptyState from "./EmptyState";

const timeFormatter = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

export default function MetricChart({ title, description, data, lines, unit, domain = [0, "auto"], threshold, height = 260 }) {
  if (!data.length) return <section className="chart-panel"><div className="panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div><EmptyState title="Chưa có dữ liệu biểu đồ" description="Biểu đồ sẽ xuất hiện khi thiết bị gửi metric." /></section>;
  return (
    <section className="chart-panel">
      <div className="panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><span className="chart-unit">{unit}</span></div>
      <div className="chart-container" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 16, left: -12, bottom: 2 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="collected_at" tickFormatter={timeFormatter} minTickGap={42} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis domain={domain} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={54} unit={unit} />
            <Tooltip labelFormatter={(value) => "Thời gian: " + timeFormatter(value)} formatter={(value, name) => [value == null ? "—" : Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " " + unit, name]} contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" }} />
            {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
            {threshold != null && <ReferenceLine y={threshold} stroke="var(--critical)" strokeDasharray="6 5" label={{ value: "Ngưỡng cảnh báo", fill: "var(--critical)", fontSize: 11, position: "insideTopRight" }} />}
            {lines.map((line) => <Line key={line.dataKey} type="monotone" dataKey={line.dataKey} name={line.name} stroke={line.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
