import { useMemo, useState } from "react";
import { Download, Filter, RotateCcw, BarChart3 } from "lucide-react";
import DashboardCharts from "../components/DashboardCharts";

const MODE_OPTIONS = ["CHARGE", "DISCHARGE", "IDLE"];
const PRESETS = [
  { key: "NONE", label: "Any time" },
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "custom", label: "Custom" }
];

function inferMode(reading, sessionType) {
  if (typeof sessionType === "string") {
    const lower = sessionType.toLowerCase();
    if (lower.includes("charge")) return "CHARGE";
    if (lower.includes("discharge")) return "DISCHARGE";
  }
  if (reading.current > 0.2) return "CHARGE";
  if (reading.current < -0.2) return "DISCHARGE";
  return "IDLE";
}

function toIsoTimestamp(startTime, offsetSeconds) {
  const startedAt = new Date(startTime).getTime();
  if (!Number.isFinite(startedAt)) return null;
  const offsetMs = Number(offsetSeconds || 0) * 1000;
  return new Date(startedAt + offsetMs).toISOString();
}

function buildCsv(records) {
  const columns = [
    "timestamp",
    "batteryId",
    "sessionId",
    "testId",
    "type",
    "uid",
    "ambientTemperature",
    "capacity",
    "re",
    "rct",
    "status",
    "sourceFile",
    "mode",
    "time",
    "voltage",
    "current",
    "temperature",
    "action"
  ];

  const escapeCell = (value) => {
    const text = value == null ? "" : String(value);
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replace(/\"/g, '""')}"`;
    }
    return text;
  };

  const rows = records.map((row) => columns.map((key) => escapeCell(row[key])).join(","));
  return [columns.join(","), ...rows].join("\n");
}

function toInputDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function HistoryAnalytics({ data, selectedBattery, onBatteryChange }) {
  const [batteryFilter, setBatteryFilter] = useState(selectedBattery || "ALL");
  const [preset, setPreset] = useState("NONE");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedModes, setSelectedModes] = useState(MODE_OPTIONS);
  const [showDashboard, setShowDashboard] = useState(false);

  const records = useMemo(() => {
    const allRows = (data?.testSessions ?? []).flatMap((session) => {
      return (session.readings ?? []).map((reading) => {
        const timestamp = toIsoTimestamp(session.startTime, reading.time);
        return {
          timestamp,
          timestampMs: timestamp ? new Date(timestamp).getTime() : null,
          batteryId: session.batteryId,
          sessionId: session.sessionId,
          testId: session.testId,
          type: session.type,
          uid: session.uid,
          ambientTemperature: session.ambientTemperature,
          capacity: session.capacity,
          re: session.re,
          rct: session.rct,
          status: session.status,
          sourceFile: session.sourceFile,
          mode: inferMode(reading, session.type),
          time: reading.time,
          voltage: reading.voltage,
          current: reading.current,
          temperature: reading.temperature,
          action: reading.action || ""
        };
      });
    });

    return allRows
      .filter((row) => Number.isFinite(row.timestampMs))
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [data]);

  const dateRange = useMemo(() => {
    const now = Date.now();
    if (preset === "24h") return { start: now - 24 * 60 * 60 * 1000, end: now };
    if (preset === "7d") return { start: now - 7 * 24 * 60 * 60 * 1000, end: now };
    if (preset === "30d") return { start: now - 30 * 24 * 60 * 60 * 1000, end: now };
    if (preset === "custom") {
      const start = customStart ? new Date(customStart).getTime() : null;
      const end = customEnd ? new Date(customEnd).getTime() : null;
      return {
        start: Number.isFinite(start) ? start : null,
        end: Number.isFinite(end) ? end : null
      };
    }
    return null;
  }, [customEnd, customStart, preset]);

  const hasModeFilter = selectedModes.length !== MODE_OPTIONS.length;
  const hasDateFilter = preset !== "NONE";
  const hasBatteryFilter = batteryFilter !== "ALL";
  const hasFilters = hasModeFilter || hasDateFilter || hasBatteryFilter;

  const filteredRecords = useMemo(() => {
    return records.filter((row) => {
      if (batteryFilter !== "ALL" && row.batteryId !== batteryFilter) return false;
      if (!selectedModes.includes(row.mode)) return false;
      if (!dateRange) return true;
      if (dateRange.start != null && row.timestampMs < dateRange.start) return false;
      if (dateRange.end != null && row.timestampMs > dateRange.end) return false;
      return true;
    });
  }, [batteryFilter, dateRange, records, selectedModes]);

  const rowsForTable = hasFilters ? filteredRecords : records.slice(0, 10);
  const exportScopeLabel = hasFilters ? "Filtered dataset" : "Default: last 30 days";

  const csvRows = useMemo(() => {
    if (hasFilters) return filteredRecords;
    const now = Date.now();
    const last30dStart = now - 30 * 24 * 60 * 60 * 1000;
    return records.filter((row) => row.timestampMs >= last30dStart && row.timestampMs <= now);
  }, [filteredRecords, hasFilters, records]);

  function toggleMode(mode) {
    setSelectedModes((current) => {
      if (current.includes(mode)) return current.filter((item) => item !== mode);
      return [...current, mode];
    });
  }

  function setModeSelection(next) {
    setSelectedModes(next);
  }

  function resetFilters() {
    setBatteryFilter("ALL");
    setPreset("NONE");
    setCustomStart("");
    setCustomEnd("");
    setSelectedModes(MODE_OPTIONS);
  }

  function setDatePreset(nextPreset) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      setCustomStart("");
      setCustomEnd("");
    }
  }

  const activeFilterBadges = useMemo(() => {
    const badges = [];
    if (batteryFilter !== "ALL") badges.push({ key: "battery", label: `Battery: ${batteryFilter}` });
    if (preset !== "NONE") {
      const presetLabel = PRESETS.find((item) => item.key === preset)?.label ?? preset;
      if (preset === "custom") {
        const startLabel = customStart ? toInputDateTime(customStart).replace("T", " ") : "…";
        const endLabel = customEnd ? toInputDateTime(customEnd).replace("T", " ") : "…";
        badges.push({ key: "date", label: `Date: ${startLabel} → ${endLabel}` });
      } else {
        badges.push({ key: "date", label: `Date: ${presetLabel}` });
      }
    }
    if (hasModeFilter) {
      badges.push({ key: "mode", label: `Mode: ${selectedModes.slice().sort().join(", ")}` });
    }
    return badges;
  }, [batteryFilter, customEnd, customStart, hasModeFilter, preset, selectedModes]);

  function exportCsv() {
    const csv = buildCsv(csvRows);
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const fileName = `battery_data_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="history-page">
      <header className="history-hero">
        <div className="history-hero-copy">
          <h1>Battery Analytics</h1>
          <p>Filter, inspect, and export historical battery telemetry from all recorded sessions.</p>
        </div>
        <div className="history-hero-actions">
          <button type="button" className="history-visualization" onClick={() => setShowDashboard(!showDashboard)}>
            <BarChart3 size={16} /> {showDashboard ? "Hide" : "Show"} Visualization
          </button>
          <button type="button" className="history-export" onClick={exportCsv}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </header>

      <section className="history-stats" aria-label="Analytics summary">
        <article>
          <span>Total Records</span>
          <strong>{records.length}</strong>
        </article>
        <article>
          <span>Visible Records</span>
          <strong>{rowsForTable.length}</strong>
        </article>
        <article>
          <span>Export Scope</span>
          <strong>{exportScopeLabel}</strong>
        </article>
      </section>

      {showDashboard && filteredRecords.length > 0 && (
        <section className="panel history-controls visualization-filters">
          <div className="filters-wrapper">
        <div className="history-controls-head">
          <div className="history-controls-title">
            <h2><Filter size={18} /> Filter Configuration</h2>
            <span>Adjust filters to refine visualization insights</span>
          </div>
          <button type="button" className="history-reset" onClick={resetFilters} disabled={!hasFilters}>
            <RotateCcw size={15} /> Reset
          </button>
        </div>

        {activeFilterBadges.length > 0 ? (
          <div className="history-active-filters" aria-label="Active filters">
            {activeFilterBadges.map((badge) => (
              <span key={badge.key} className="history-filter-badge">
                {badge.label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="history-filter-grid">
          <div className="history-filter-card battery-card">
            <label>
              Battery Type
              <select value={batteryFilter} onChange={(event) => {
                setBatteryFilter(event.target.value);
                if (onBatteryChange) onBatteryChange(event.target.value);
              }}>
                <option value="ALL">All batteries</option>
                {(data?.batteries ?? []).map((battery) => (
                  <option key={battery.batteryId} value={battery.batteryId}>{battery.batteryId}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="history-filter-card date-card">
            <legend>Date Range</legend>
            <div className="preset-row">
              {PRESETS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={preset === item.key ? "active" : ""}
                  onClick={() => setDatePreset(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {preset === "custom" ? (
              <div className="custom-date-row">
                <label>
                  Start
                  <input
                    type="datetime-local"
                    value={toInputDateTime(customStart)}
                    onChange={(event) => {
                      setPreset("custom");
                      setCustomStart(event.target.value);
                    }}
                    aria-label="Custom start date"
                  />
                </label>
                <label>
                  End
                  <input
                    type="datetime-local"
                    value={toInputDateTime(customEnd)}
                    onChange={(event) => {
                      setPreset("custom");
                      setCustomEnd(event.target.value);
                    }}
                    aria-label="Custom end date"
                  />
                </label>
              </div>
            ) : null}
          </fieldset>

          <fieldset className="history-filter-card mode-card">
            <legend>Mode</legend>
            <div className="mode-actions" aria-label="Mode quick actions">
              <button type="button" onClick={() => setModeSelection(MODE_OPTIONS)}>All</button>
              <button type="button" onClick={() => setModeSelection([])}>None</button>
            </div>
            <div className="mode-row">
              {MODE_OPTIONS.map((mode) => (
                <label
                  key={mode}
                  className={`checkbox-pill ${selectedModes.includes(mode) ? "checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModes.includes(mode)}
                    onChange={() => toggleMode(mode)}
                  />
                  {mode}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
          </div>
        </section>
      )}

      {showDashboard && filteredRecords.length === 0 && (
        <div className="visualization-prompt">
          <div className="prompt-content">
            <BarChart3 size={32} />
            <h3>No Data to Visualize</h3>
            <p>Apply filters to see battery analytics visualization based on your selections.</p>
            <div className="prompt-tips">
              <span>💡 Tip: Select a battery, date range, or operation mode to filter data</span>
            </div>
          </div>
        </div>
      )}

      {showDashboard && filteredRecords.length > 0 && <DashboardCharts records={filteredRecords} />}

      {!showDashboard && (
        <section className="panel history-controls">
          <div className="history-controls-head">
            <div className="history-controls-title">
              <h2><Filter size={16} /> Filters</h2>
              <span>Use battery, date, and mode filters together for precise analytics.</span>
            </div>
            <button type="button" className="history-reset" onClick={resetFilters} disabled={!hasFilters}>
              <RotateCcw size={15} /> Reset
            </button>
          </div>

          {activeFilterBadges.length > 0 ? (
            <div className="history-active-filters" aria-label="Active filters">
              {activeFilterBadges.map((badge) => (
                <span key={badge.key} className="history-filter-badge">
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}

          <div className="history-filter-grid">
            <div className="history-filter-card battery-card">
              <label>
                Battery Type
                <select value={batteryFilter} onChange={(event) => setBatteryFilter(event.target.value)}>
                  <option value="ALL">All batteries</option>
                  {(data?.batteries ?? []).map((battery) => (
                    <option key={battery.batteryId} value={battery.batteryId}>{battery.batteryId}</option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="history-filter-card date-card">
              <legend>Date Range</legend>
              <div className="preset-row">
                {PRESETS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={preset === item.key ? "active" : ""}
                    onClick={() => setDatePreset(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {preset === "custom" ? (
                <div className="custom-date-row">
                  <label>
                    Start
                    <input
                      type="datetime-local"
                      value={toInputDateTime(customStart)}
                      onChange={(event) => {
                        setPreset("custom");
                        setCustomStart(event.target.value);
                      }}
                      aria-label="Custom start date"
                    />
                  </label>
                  <label>
                    End
                    <input
                      type="datetime-local"
                      value={toInputDateTime(customEnd)}
                      onChange={(event) => {
                        setPreset("custom");
                        setCustomEnd(event.target.value);
                      }}
                      aria-label="Custom end date"
                    />
                  </label>
                </div>
              ) : null}
            </fieldset>

            <fieldset className="history-filter-card mode-card">
              <legend>Mode</legend>
              <div className="mode-actions" aria-label="Mode quick actions">
                <button type="button" onClick={() => setModeSelection(MODE_OPTIONS)}>All</button>
                <button type="button" onClick={() => setModeSelection([])}>None</button>
              </div>
              <div className="mode-row">
                {MODE_OPTIONS.map((mode) => (
                  <label
                    key={mode}
                    className={`checkbox-pill ${selectedModes.includes(mode) ? "checked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModes.includes(mode)}
                      onChange={() => toggleMode(mode)}
                    />
                    {mode}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </section>
      )}

      <section className="panel history-results">
        <div className="panel-head">
          <h2>{hasFilters ? "Filtered Historical Records" : "Top 10 Recent Records"}</h2>
          <span>{rowsForTable.length} records shown</span>
        </div>

        {rowsForTable.length === 0 ? (
          <p className="history-empty">No records found for the selected filters.</p>
        ) : (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Timestamp (ISO)</th>
                  <th>Battery</th>
                  <th>Mode</th>
                  <th>Voltage (V)</th>
                  <th>Current (A)</th>
                  <th>Temp (C)</th>
                  <th>Session</th>
                </tr>
              </thead>
              <tbody>
                {rowsForTable.map((row) => (
                  <tr key={`${row.sessionId}-${row.time}-${row.timestamp}`}>
                    <td>{row.timestamp}</td>
                    <td>{row.batteryId}</td>
                    <td><span className={`history-mode mode-${row.mode.toLowerCase()}`}>{row.mode}</span></td>
                    <td>{Number(row.voltage).toFixed(3)}</td>
                    <td>{Number(row.current).toFixed(3)}</td>
                    <td>{Number(row.temperature).toFixed(2)}</td>
                    <td>{row.sessionId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default HistoryAnalytics;
