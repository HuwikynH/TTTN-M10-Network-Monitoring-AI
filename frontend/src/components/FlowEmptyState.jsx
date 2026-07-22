export default function FlowEmptyState({ title, description, columns, deviceNote }) {
  return (
    <section className="panel flow-ready-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Sẵn sàng tích hợp</p><h2>{title}</h2></div>
        <span className="data-source-badge">Chưa có API</span>
      </div>
      {deviceNote && <div className="integration-note">{deviceNote}</div>}
      <div className="table-wrap">
        <table className="flow-ready-table">
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>
            <tr><td colSpan={columns.length}>
              <div className="flow-empty">
                <span className="flow-empty__icon" aria-hidden="true">⇄</span>
                <h3>Chưa có dữ liệu flow</h3>
                <p>{description}</p>
                <span>Giao diện này chỉ mô tả cấu trúc tích hợp, không hiển thị dữ liệu mô phỏng.</span>
              </div>
            </td></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
