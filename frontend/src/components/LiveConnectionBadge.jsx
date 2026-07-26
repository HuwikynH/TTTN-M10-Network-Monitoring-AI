import StatusBadge from "./StatusBadge";

export default function LiveConnectionBadge({ status, lastUpdated, intervalMs, onToggle, onRefresh, refreshing }) {
  return <div className="live-toolbar"><div className="live-toolbar__state"><StatusBadge status={status} /><span className={"background-refresh-status" + (refreshing ? " background-refresh-status--active" : "")} aria-live="polite">{refreshing ? "Đang cập nhật" : ""}</span><span>Cập nhật lần cuối: <strong>{lastUpdated ? lastUpdated.toLocaleTimeString("vi-VN") : "—"}</strong></span><span>Chu kỳ: <strong>{Math.round(intervalMs / 1000)} giây</strong></span></div><div className="live-toolbar__actions"><button className="button button--secondary" type="button" onClick={onToggle}>{status === "paused" ? "Tiếp tục" : "Tạm dừng"}</button><button className="button button--primary" type="button" onClick={onRefresh} disabled={refreshing}>Tải lại</button></div></div>;
}
