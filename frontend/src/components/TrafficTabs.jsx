const TABS = [
  ["overview", "Overview"],
  ["traffic", "Traffic"],
  ["application", "Application"],
  ["source", "Source"],
  ["destination", "Destination"],
  ["conversation", "Conversation"],
  ["interface", "Interface"],
  ["alarms", "Alarms"],
];

export default function TrafficTabs({ activeTab, onChange }) {
  return (
    <div className="traffic-tabs-wrap">
      <div className="traffic-tabs" role="tablist" aria-label="Chế độ giám sát lưu lượng">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            id={"traffic-tab-" + id}
            className={"traffic-tab" + (activeTab === id ? " traffic-tab--active" : "")}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={"traffic-panel-" + id}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
