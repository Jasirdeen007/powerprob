import { useMemo, useState } from "react";
import { Download, BarChart3, Table2 } from "lucide-react";
import HistoryChartsPanel from "../components/HistoryChartsPanel";
import HistoryFilters, { MODE_OPTIONS, PRESETS } from "../components/HistoryFilters";

const RECORD_LIMITS = [10, 20, 100];

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
    "timestamp", "batteryId", "sessionId", "testId", "type", "uid",
    "ambientTemperature", "capacity", "re", "rct", "status", "sourceFile",
    "mode", "time", "voltage", "current", "temperature", "action"
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
  const [activeView, setActiveView] = useState("charts");
  const [recordLimit, setRecordLimit] = useState(20);

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
    return allRows.filter((row) => Number.isFinite(row.timestampMs)).sort((a, b) => b.timestampMs - a.timestampMs);
  }, [data]);

  const dateRange = useMemo(() => {
    const now = Date.now();
    if (preset === "24h") return { start: now - 86400000, end: now };
    if (preset === "7d") return { start: now - 7 * 86400000, end: now };
    if (preset === "30d") return { start: now - 30 * 86400000, end: now };
    if (preset === "custom") {
      const start = customStart ? new Date(customStart).getTime() : null;
      const end = customEnd ? new Date(customEnd).getTime() : null;
      return { start: Number.isFinite(start) ? start : null, end: Number.isFinite(end) ? end : null };
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

  const rowsForTable = useMemo(() => filteredRecords.slice(0, recordLimit), [filteredRecords, recordLimit]);

  const csvRows = useMemo(() => {
    if (hasFilters) return filteredRecords;
    const now = Date.now();
    return records.filter((row) => row.timestampMs >= now - 30 * 86400000);
  }, [filteredRecords, hasFilters, records]);

  function toggleMode(mode) {
    setSelectedModes((current) => {
      if (current.includes(mode)) return current.filter((item) => item !== mode);
      return [...current, mode];
    });
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
        badges.push({ key: "date", label: `Custom range` });
      } else {
        badges.push({ key: "date", label: presetLabel });
      }
    }
    if (hasModeFilter) badges.push({ key: "mode", label: selectedModes.join(", ") });
    return badges;
  }, [batteryFilter, hasModeFilter, preset, selectedModes]);

  function exportCsv() {
    const csv = buildCsv(csvRows);
    const date = new Date();
    const pad = (v) => String(v).padStart(2, "0");
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
          <h1>History Analytics</h1>
          <p>Filter telemetry, view charts, or browse the data table.</p>
        </div>
        <div className="history-hero-actions">
          <div className="history-view-tabs">
            <button
              type="button"
              className={`history-view-tab ${activeView === "charts" ? "active" : ""}`}
              onClick={() => setActiveView("charts")}
            >
              <BarChart3 size={16} /> Charts
            </button>
            <button
              type="button"
              className={`history-view-tab ${activeView === "table" ? "active" : ""}`}
              onClick={() => setActiveView("table")}
            >
              <Table2 size={16} /> Data table
            </button>
          </div>
          <button type="button" className="history-export" onClick={exportCsv}>
            <Download size={16} /> Export
          </button>
        </div>
      </header>

      <HistoryFilters
        batteryFilter={batteryFilter}
        onBatteryFilterChange={(v) => { setBatteryFilter(v); onBatteryChange?.(v); }}
        batteries={data?.batteries ?? []}
        preset={preset}
        onPresetChange={setDatePreset}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={(v) => { setPreset("custom"); setCustomStart(v); }}
        onCustomEndChange={(v) => { setPreset("custom"); setCustomEnd(v); }}
        selectedModes={selectedModes}
        onToggleMode={toggleMode}
        onModeSelectAll={() => setSelectedModes(MODE_OPTIONS)}
        onModeSelectNone={() => setSelectedModes([])}
        onReset={resetFilters}
        hasFilters={hasFilters}
        activeFilterBadges={activeFilterBadges}
        recordCount={records.length}
        filteredCount={filteredRecords.length}
        toInputDateTime={toInputDateTime}
      />

      {activeView === "charts" && <HistoryChartsPanel records={filteredRecords} />}

      {activeView === "table" && (
        <section className="panel history-results">
          <div className="history-results-head">
            <h2>Session records</h2>
            <div className="history-limit-picker">
              <span>Show</span>
              {RECORD_LIMITS.map((limit) => (
                <button
                  key={limit}
                  type="button"
                  className={recordLimit === limit ? "active" : ""}
                  onClick={() => setRecordLimit(limit)}
                >
                  {limit}
                </button>
              ))}
            </div>
          </div>
          {rowsForTable.length === 0 ? (
            <p className="history-empty">No records found for the selected filters.</p>
          ) : (
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Battery</th>
                    <th>Mode</th>
                    <th>Voltage (V)</th>
                    <th>Current (A)</th>
                    <th>Temp (°C)</th>
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
      )}
    </section>
  );
}

export default HistoryAnalytics;
