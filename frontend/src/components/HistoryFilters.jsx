import { Filter, RotateCcw } from "lucide-react";

const PRESETS = [
  { key: "NONE", label: "All" },
  { key: "custom", label: "Custom" }
];

function HistoryFilters({
  preset,
  onPresetChange,
  sessionId,
  sessionOptions = [],
  onSessionChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  onReset,
  hasFilters,
  activeFilterBadges = [],
  recordCount = 0,
  filteredCount = 0,
  toInputDate
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
        <div className="history-filter-block history-filter-session">
          <div className="history-filter-block-head">
            <span className="history-filter-label">Session</span>
          </div>
          <select
            value={sessionId}
            onChange={(event) => onSessionChange(event.target.value)}
          >
            <option value="ALL">All sessions</option>
            {sessionOptions.map((session) => (
              <option key={session.sessionId} value={session.sessionId}>
                {session.label}
              </option>
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
            <div className="history-custom-range">
              <div className="history-custom-dates">
                <label>
                  <span>Start date</span>
                  <input
                    type="date"
                    value={toInputDate(customStart)}
                    onChange={(e) => onCustomStartChange(e.target.value)}
                    placeholder="dd-mm-yyyy"
                  />
                </label>
                <label>
                  <span>End date</span>
                  <input
                    type="date"
                    value={toInputDate(customEnd)}
                    onChange={(e) => onCustomEndChange(e.target.value)}
                    placeholder="dd-mm-yyyy"
                  />
                </label>
              </div>
              <p className="history-custom-help">Use the calendar picker or choose a quick range. End date includes the full selected day.</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export { PRESETS };
export default HistoryFilters;
