import StatusBadge from "./StatusBadge";

export default function LiveConnectionBadge({ status, lastUpdated, intervalMs, onToggle, onRefresh, refreshing }) {
  return <div className="live-toolbar" aria-live="polite"><div className="live-toolbar__state"><StatusBadge status={status} /><span>Cập nhật lần cuối: <strong>{lastUpdated ? lastUpdated.toLocaleTimeString("vi-VN") : "—"}</strong></span><span>Chu kỳ: <strong>{Math.round(intervalMs / 1000)} giây</strong></span></div><div className="live-toolbar__actions"><button className="button button--secondary" type="button" onClick={onToggle}>{status === "paused" ? "Tiếp tục" : "Tạm dừng"}</button><button className="button button--primary" type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? "Đang tải…" : "Tải lại"}</button></div></div>;
}
