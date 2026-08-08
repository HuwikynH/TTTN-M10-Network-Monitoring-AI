import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatDateTime } from "../utils";

const SCENARIOS = [
  { key: "high_traffic", label: "High traffic", color: "var(--chart-scenario-1)" },
  { key: "high_latency", label: "High latency", color: "var(--chart-scenario-2)" },
  { key: "stress_cpu", label: "Stress CPU", color: "var(--chart-scenario-3)" },
  { key: "baseline", label: "Baseline", color: "var(--chart-scenario-4)" },
  { key: "packet_loss", label: "Packet loss", color: "var(--chart-scenario-5)" },
  { key: "attack_test", label: "Attacked", color: "var(--chart-scenario-6)" },
];

function percent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
}

function PredictionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const scenario = payload[0].payload;
  return (
    <div className="ai-chart-tooltip">
      <strong>{scenario.label}</strong>
      <span>{scenario.value.toFixed(1)}%</span>
    </div>
  );
}

function DonutPercentLabel({ cx, cy, midAngle, innerRadius, outerRadius, value }) {
  if (value < 1.5) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const radians = (-midAngle * Math.PI) / 180;
  const x = cx + radius * Math.cos(radians);
  const y = cy + radius * Math.sin(radians);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central">
      {value.toFixed(0)}%
    </text>
  );
}

export default function DeviceAiPrediction({ deviceName, prediction }) {
  const probabilities = prediction?.scenario_probabilities;
  const hasPrediction = probabilities && Object.keys(probabilities).length > 0;
  const data = SCENARIOS
    .map((scenario) => ({ ...scenario, value: percent(probabilities?.[scenario.key]) }))
    .sort((a, b) => b.value - a.value);
  const topScenario = prediction?.top_scenario || data[0]?.key;
  const topEntry = data.find((scenario) => scenario.key === topScenario) || data[0];
  const riskScore = percent(prediction?.risk_score);
  const isAbnormal = prediction?.status === "abnormal";

  return (
    <section className="ai-prediction-panel panel" aria-labelledby="ai-prediction-title">
      <div className="ai-prediction-heading">
        <div className="ai-prediction-brand">
          <span className="ai-brandmark" aria-hidden="true">AI</span>
          <div>
            <h2 id="ai-prediction-title">AI Network Monitoring</h2>
            <p>Scenario Probability <span>• {deviceName}</span></p>
          </div>
        </div>
        {hasPrediction && (
          <div className="ai-heading-result">
            <span className={`ai-status ai-status--${isAbnormal ? "abnormal" : "normal"}`}>
              {isAbnormal ? "Abnormal" : "Normal"}
            </span>
            <div>
              <span>Risk score</span>
              <strong>{riskScore.toFixed(0)}%</strong>
            </div>
          </div>
        )}
      </div>

      {!hasPrediction ? (
        <div className="ai-prediction-empty">
          <div className="ai-empty-ring" aria-hidden="true"><span>AI</span></div>
          <div>
            <h3>Chưa có dự đoán AI</h3>
            <p>Khối xác suất sẽ xuất hiện sau khi backend kết nối model và xử lý metric của thiết bị này.</p>
          </div>
        </div>
      ) : (
        <div className="ai-prediction-content">
          <div className="ai-donut" aria-label={`Kịch bản có khả năng cao nhất: ${topEntry.label}`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="58%"
                  outerRadius="96%"
                  paddingAngle={1}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  labelLine={false}
                  label={<DonutPercentLabel />}
                  isAnimationActive={false}
                >
                  {data.map((scenario) => <Cell key={scenario.key} fill={scenario.color} />)}
                </Pie>
                <Tooltip content={<PredictionTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="ai-donut-center">
              <strong style={{ color: topEntry.color }}>{topEntry.label}</strong>
            </div>
          </div>

          <div className="scenario-confidence">
            <div className="scenario-list">
              {data.map((scenario) => (
                <div className="scenario-row" key={scenario.key}>
                  <span className="scenario-dot" style={{ backgroundColor: scenario.color }} />
                  <span>{scenario.label}</span>
                  <strong>{scenario.value.toFixed(1)}%</strong>
                </div>
              ))}
            </div>
            <p>Prediction #{prediction.id} • {formatDateTime(prediction.predicted_at)}</p>
          </div>
        </div>
      )}
    </section>
  );
}
