import { Filter, RotateCcw } from "lucide-react";

const PRESETS = [
  { key: "NONE", label: "Any time" },
  { key: "custom", label: "Custom" }
];

function HistoryFilters({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  onReset,
  hasFilters,
  activeFilterBadges = [],
  recordCount = 0,
  filteredCount = 0,
  toInputDateTime
}) {
  return (
    <section className="panel history-filters-panel">
      <div className="history-controls-head">
        <div className="history-controls-title">
          <h2><Filter size={18} /> Filters</h2>
          <span>{filteredCount} of {recordCount} records</span>
        </div>
        <button type="button" className="history-reset" onClick={onReset} disabled={!hasFilters}>
          <RotateCcw size={15} /> Reset
        </button>
      </div>

      {activeFilterBadges.length > 0 ? (
        <div className="history-active-filters">
          {activeFilterBadges.map((badge) => (
            <span key={badge.key} className="history-filter-badge">{badge.label}</span>
          ))}
        </div>
      ) : null}

      <div className="history-filters-layout">
        <div className="history-filter-block history-filter-date">
          <div className="history-filter-block-head">
            <span className="history-filter-label">Date range</span>
          </div>
          <div className="history-preset-grid">
            {PRESETS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`history-preset-btn ${preset === item.key ? "active" : ""}`}
                onClick={() => onPresetChange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {preset === "custom" ? (
            <div className="history-custom-dates">
              <label>
                <span>Start</span>
                <input
                  type="datetime-local"
                  value={toInputDateTime(customStart)}
                  onChange={(e) => onCustomStartChange(e.target.value)}
                />
              </label>
              <label>
                <span>End</span>
                <input
                  type="datetime-local"
                  value={toInputDateTime(customEnd)}
                  onChange={(e) => onCustomEndChange(e.target.value)}
                />
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export { PRESETS };
export default HistoryFilters;
