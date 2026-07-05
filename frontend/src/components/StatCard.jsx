export default function StatCard({ label, value, description, variant = "total", symbol }) {
  return (
    <article className={`summary-card summary-card--${variant}`}>
      <div className="summary-card__topline">
        <span>{label}</span>
        {symbol && <span className="summary-card__symbol" aria-hidden="true">{symbol}</span>}
      </div>
      <strong>{value}</strong>
      <small>{description}</small>
    </article>
  );
}
