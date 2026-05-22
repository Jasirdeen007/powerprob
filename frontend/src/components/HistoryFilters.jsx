import { Filter, RotateCcw } from "lucide-react";

const MODE_OPTIONS = ["CHARGE", "DISCHARGE", "IDLE"];
const PRESETS = [
  { key: "NONE", label: "Any time" },
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "custom", label: "Custom" }
];

function HistoryFilters({
  batteryFilter,
  onBatteryFilterChange,
  batteries = [],
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  selectedModes,
  onToggleMode,
  onModeSelectAll,
  onModeSelectNone,
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
        <div className="history-filter-block history-filter-battery">
          <label className="history-filter-label">Battery</label>
          <select value={batteryFilter} onChange={(e) => onBatteryFilterChange(e.target.value)}>
            <option value="ALL">All batteries</option>
            {batteries.map((battery) => (
              <option key={battery.batteryId} value={battery.batteryId}>{battery.batteryId}</option>
            ))}
          </select>
        </div>

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

        <div className="history-filter-block history-filter-mode">
          <div className="history-filter-block-head">
            <span className="history-filter-label">Operation mode</span>
            <div className="history-mode-quick">
              <button type="button" onClick={onModeSelectAll}>All</button>
              <button type="button" onClick={onModeSelectNone}>Clear</button>
            </div>
          </div>
          <div className="history-mode-pills">
            {MODE_OPTIONS.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`history-mode-pill mode-${mode.toLowerCase()} ${selectedModes.includes(mode) ? "active" : ""}`}
                onClick={() => onToggleMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export { MODE_OPTIONS, PRESETS };
export default HistoryFilters;
