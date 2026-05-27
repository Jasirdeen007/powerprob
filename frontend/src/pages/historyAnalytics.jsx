import { useMemo, useState } from "react";
import { Download, BarChart3, Table2 } from "lucide-react";
import HistoryChartsPanel from "../components/HistoryChartsPanel";
import HistoryFilters, { PRESETS } from "../components/HistoryFilters";
import { downloadBlob, downloadJson, timestampForFile } from "../lib/exportUtils";

function inferMode(reading, sessionType) {
  if (typeof sessionType === "string") {
    const lower = sessionType.toLowerCase();
    if (lower.includes("discharge")) return "DISCHARGE";
    if (lower.includes("charge") || lower.includes("chg") || lower.includes("balance")) return "CHARGE";
    if (lower.includes("pulse")) return "DISCHARGE";
  }
  if (reading.current > 0.2) return "DISCHARGE";
  if (reading.current < -0.2) return "CHARGE";
  return "IDLE";
}

function toIsoTimestamp(startTime, offsetSeconds) {
  const startedAt = new Date(startTime).getTime();
  if (!Number.isFinite(startedAt)) return null;
  const offsetMs = Number(offsetSeconds || 0) * 1000;
  return new Date(startedAt + offsetMs).toISOString();
}

function isRealPiSession(session) {
  if (!session || session.status !== "completed") return false;
  return ["backend", "firebase-live"].includes(session.sourceFile);
}

function isRealPiReading(reading) {
  if (!reading) return false;
  if (reading.timestamp) return true;
  return [reading.voltage, reading.current, reading.temperature].some((value) => Number(value) !== 0);
}

function buildCsv(records) {
  const columns = [
    "timestamp", "batteryId", "batteryName", "sessionId", "testId", "type", "uid",
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
  const [preset, setPreset] = useState("NONE");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [activeView, setActiveView] = useState("charts");
  const [exportOpen, setExportOpen] = useState(false);

  const records = useMemo(() => {
    const realSessions = (data?.testSessions ?? []).filter(isRealPiSession);
    const allRows = realSessions.flatMap((session) => {
      return (session.readings ?? []).filter(isRealPiReading).map((reading) => {
        const timestamp = reading.timestamp || toIsoTimestamp(session.startTime, reading.time);
        return {
          timestamp,
          timestampMs: timestamp ? new Date(timestamp).getTime() : null,
          batteryId: session.batteryId,
          batteryName: session.batteryName || "",
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

  const batteryOptions = useMemo(() => {
    const byId = new Map();
    for (const row of records) {
      if (!row.batteryId) continue;
      const current = byId.get(row.batteryId);
      byId.set(row.batteryId, {
        batteryId: row.batteryId,
        batteryName: row.batteryName || current?.batteryName || ""
      });
    }
    return Array.from(byId.values()).sort((a, b) => {
      const labelA = a.batteryName || a.batteryId;
      const labelB = b.batteryName || b.batteryId;
      return labelA.localeCompare(labelB);
    });
  }, [records]);

  const dateRange = useMemo(() => {
    const latestRecordTime = records[0]?.timestampMs;
    const now = Number.isFinite(latestRecordTime) ? latestRecordTime : Date.now();
    if (preset === "custom") {
      const start = customStart ? new Date(customStart).getTime() : null;
      const end = customEnd ? new Date(customEnd).getTime() : null;
      return { start: Number.isFinite(start) ? start : null, end: Number.isFinite(end) ? end : null };
    }
    return null;
  }, [customEnd, customStart, preset, records]);

  const hasDateFilter = preset !== "NONE";
  const hasFilters = hasDateFilter;

  const filteredRecords = useMemo(() => {
    return records.filter((row) => {
      if (!dateRange) return true;
      if (dateRange.start != null && row.timestampMs < dateRange.start) return false;
      if (dateRange.end != null && row.timestampMs > dateRange.end) return false;
      return true;
    });
  }, [dateRange, records]);

  const csvRows = useMemo(() => {
    if (hasFilters) return filteredRecords;
    const now = Date.now();
    return records.filter((row) => row.timestampMs >= now - 30 * 86400000);
  }, [filteredRecords, hasFilters, records]);

  function resetFilters() {
    setPreset("NONE");
    setCustomStart("");
    setCustomEnd("");
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
    if (preset !== "NONE") {
      const presetLabel = PRESETS.find((item) => item.key === preset)?.label ?? preset;
      if (preset === "custom") {
        badges.push({ key: "date", label: `Custom range` });
      } else {
        badges.push({ key: "date", label: presetLabel });
      }
    }
    return badges;
  }, [preset]);

  function exportCsv() {
    const csv = buildCsv(csvRows);
    downloadBlob(csv, `battery_data_${timestampForFile()}.csv`, "text/csv;charset=utf-8;");
    setExportOpen(false);
  }

  function exportJson() {
    downloadJson(csvRows, `battery_data_${timestampForFile()}.json`);
    setExportOpen(false);
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
          <div className="history-export-menu">
            <button type="button" className="history-export" onClick={() => setExportOpen((open) => !open)}>
              <Download size={16} /> Export
            </button>
            {exportOpen ? (
              <div className="history-export-options">
                <button type="button" onClick={exportCsv}>CSV</button>
                <button type="button" onClick={exportJson}>JSON</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <HistoryFilters
        preset={preset}
        onPresetChange={setDatePreset}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={(v) => { setPreset("custom"); setCustomStart(v); }}
        onCustomEndChange={(v) => { setPreset("custom"); setCustomEnd(v); }}
        onReset={resetFilters}
        hasFilters={hasFilters}
        activeFilterBadges={activeFilterBadges}
        recordCount={records.length}
        filteredCount={filteredRecords.length}
        toInputDateTime={toInputDateTime}
      />

      {activeView === "charts" && <HistoryChartsPanel records={filteredRecords} batteries={batteryOptions} />}

      {activeView === "table" && (
        <section className="panel history-results">
          <div className="history-results-head">
            <div>
              <h2>Session records</h2>
              <p className="history-results-sub">Showing all {filteredRecords.length} filtered records</p>
            </div>
          </div>
          {filteredRecords.length === 0 ? (
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
                  {filteredRecords.map((row) => (
                    <tr key={`${row.sessionId}-${row.time}-${row.timestamp}`}>
                      <td>{row.timestamp}</td>
                      <td>{row.batteryName ? `${row.batteryName} (${row.batteryId})` : row.batteryId}</td>
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
