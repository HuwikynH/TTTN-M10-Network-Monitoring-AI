import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "./StateFeedback";

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export default function MetricChart({ metrics, dataKey, title, unit, color = "var(--color-primary)", domain }) {
  const chartData = metrics
    .filter((metric) => metric[dataKey] !== null && metric[dataKey] !== undefined)
    .map((metric) => ({
      ...metric,
      timestamp: new Date(metric.collected_at).getTime(),
    }))
    .filter((metric) => Number.isFinite(metric.timestamp) && Number.isFinite(Number(metric[dataKey])))
    .sort((first, second) => first.timestamp - second.timestamp);

  return (
    <article className="panel chart-panel">
      <div className="panel-heading panel-heading--compact">
        <div>
          <p className="eyebrow">Lịch sử chỉ số</p>
          <h2>{title}</h2>
        </div>
        <span className="chart-unit">{unit}</span>
      </div>

      {chartData.length === 0 ? (
        <EmptyState message={`Chưa có dữ liệu ${title.toLowerCase()}.`} compact />
      ) : (
        <div className="chart-container" role="img" aria-label={`Biểu đồ ${title.toLowerCase()} theo thời gian`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 14, right: 14, left: -10, bottom: 4 }}>
              <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatTime}
                stroke="var(--color-chart-axis)"
                tick={{ fill: "var(--color-chart-axis)", fontSize: 12 }}
                minTickGap={36}
              />
              <YAxis
                domain={domain || [0, "auto"]}
                stroke="var(--color-chart-axis)"
                tick={{ fill: "var(--color-chart-axis)", fontSize: 12 }}
                tickFormatter={(value) => `${value}${unit}`}
                width={64}
              />
              <Tooltip
                labelFormatter={formatTime}
                formatter={(value) => [`${Number(value).toLocaleString("vi-VN")} ${unit}`, title]}
                contentStyle={{
                  background: "var(--color-chart-tooltip)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-text-primary)",
                }}
                labelStyle={{ color: "var(--color-text-secondary)", marginBottom: "6px" }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: color }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
