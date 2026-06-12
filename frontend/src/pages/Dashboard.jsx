import { useState } from "react";
import { Activity, Eye, EyeOff, FileText, Flame, Gauge, Play, Pause, Square, Zap, BatteryFull, Settings, Wifi, WifiOff } from "lucide-react";
import MetricCard from "../components/MetricCard";
import TelemetryChartCard from "../components/TelemetryChartCard";
import ConfigurationModal from "../components/ConfigurationModal";
import ChargeConfigurationModal from "../components/ChargeConfigurationModal";
import ChargeDischargeModal from "../components/ChargeDischargeModal";
import CustomChartBuilder from "../components/CustomChartBuilder";
import { statusLabel } from "../data/appConfig";
import { clamp } from "../lib/battery";

const ZERO_READING = {
  time: 0,
  voltage: 0,
  current: 0,
  temperature: 0,
  soc: 0,
  soh: 0,
  power: 0,
  status: "healthy"
};

const GLOBAL_CHART_TYPES = [
  { key: "line", label: "Line" },
  { key: "area", label: "Area" },
  { key: "scatter", label: "Scatter" },
  { key: "bar", label: "Bar" }
];

const GLOBAL_METRICS = [
  { title: "Voltage Trend", metricKey: "voltage", unit: "V", color: "#2563eb" },
  { title: "Current Load", metricKey: "current", unit: "A", color: "#db2777" },
  { title: "Thermal Profile", metricKey: "temperature", unit: "C", color: "#dc2626" },
  { title: "Power Consumption", metricKey: "power", unit: "W", color: "#7c3aed" },
  { title: "State of Charge", metricKey: "soc", unit: "%", color: "#15915b", forceYRange: { min: 0, max: 100 } },
  { title: "State of Health", metricKey: "soh", unit: "%", color: "#0f766e", forceYRange: { min: 0, max: 100 } }
];

function isRealPiReading(reading) {
  if (!reading) return false;
  if (reading.timestamp) return true;
  return [reading.voltage, reading.current, reading.temperature].some((value) => Number(value) !== 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatReportNumber(value, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "0.00";
}

function buildReportLineChart(readings, metricKey, label, unit, color = "#2563eb") {
  const chartWidth = 680;
  const chartHeight = 190;
  const padX = 44;
  const padY = 28;
  const values = readings.map((row) => Number(row?.[metricKey])).filter(Number.isFinite);
  if (values.length === 0) {
    return `<div class="report-chart-empty">No ${escapeHtml(label)} data available.</div>`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = readings
    .map((row, index) => {
      const value = Number(row?.[metricKey]);
      if (!Number.isFinite(value)) return null;
      const x = padX + (index / Math.max(1, readings.length - 1)) * (chartWidth - padX * 2);
      const y = chartHeight - padY - ((value - min) / range) * (chartHeight - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  return `
    <div class="report-chart-card">
      <div class="report-chart-head">
        <strong>${escapeHtml(label)}</strong>
        <span>Min ${formatReportNumber(min)} ${unit} | Max ${formatReportNumber(max)} ${unit}</span>
      </div>
      <svg viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="${escapeHtml(label)} chart">
        <line x1="${padX}" y1="${chartHeight - padY}" x2="${chartWidth - padX}" y2="${chartHeight - padY}" />
        <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${chartHeight - padY}" />
        <text x="${padX}" y="18">${formatReportNumber(max)} ${unit}</text>
        <text x="${padX}" y="${chartHeight - 6}">${formatReportNumber(min)} ${unit}</text>
        <polyline points="${points}" style="stroke:${color}" />
      </svg>
    </div>
  `;
}

function Dashboard({ livePoint, liveStream, selectedSession, activeBattery, activeSession = {}, profiles = [], onStartSession, onEndSession, onPauseSession, piStatus, userId }) {
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [chargeConfigModalOpen, setChargeConfigModalOpen] = useState(false);
  const [operationMode, setOperationMode] = useState("discharge");

  const [cRating, setCRating] = useState("25");
  const [batteryType, setBatteryType] = useState("Li-ion");
  const [mah, setMah] = useState("2200");
  const [numCells, setNumCells] = useState("3");
  const [voltage, setVoltage] = useState("11.1");
  const [droneProfile, setDroneProfile] = useState("Surveillance Drone");

  const [chargeBatteryType, setChargeBatteryType] = useState("LiPo");
  const [chargeVoltage, setChargeVoltage] = useState("11.1");
  const [chargeCurrent, setChargeCurrent] = useState("2.2");

  const [sessionPending, setSessionPending] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [batteryName, setBatteryName] = useState("");
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [instrumentHidden, setInstrumentHidden] = useState(false);
  const [globalChartsHidden, setGlobalChartsHidden] = useState(false);
  const [globalChartType, setGlobalChartType] = useState("line");
  const [globalChartVersion, setGlobalChartVersion] = useState(0);
  const [focusedMetric, setFocusedMetric] = useState("");

  const piConnected = Boolean(piStatus?.connected);
  const liveReadings = Array.isArray(liveStream) ? liveStream : [];
  const activeSessionId = activeSession.sessionId ?? "";
  const activeDeviceId = activeSession.deviceId ?? "";
  const isRunning = Boolean(activeSession.isRunning);
  const isPaused = Boolean(activeSession.isPaused);
  const isDemoSession = Boolean(activeSession.isDemo);
  const activeSessionMap = piStatus?.active_sessions ?? {};
  const deviceSessionMap = piStatus?.device_sessions ?? {};
  const deviceEntries = Object.entries(piStatus?.devices ?? {});
  const reportedSessionIds = [
    ...Object.keys(activeSessionMap),
    ...Object.values(deviceSessionMap),
    ...deviceEntries.map(([, device]) => device?.active_session_id)
  ].filter(Boolean);
  const reportedActiveSessions = new Set(reportedSessionIds);
  const firstReportedSessionId = reportedSessionIds[0] ?? "";
  const latestLiveSessionId = liveReadings.at(-1)?.sessionId ?? "";
  const visibleSessionId = activeSessionId || (reportedActiveSessions.has(latestLiveSessionId) ? latestLiveSessionId : firstReportedSessionId);
  const visibleDeviceId = activeDeviceId || activeSessionMap[visibleSessionId] || Object.entries(deviceSessionMap).find(([, sessionId]) => sessionId === visibleSessionId)?.[0] || "";
  const visibleDeviceState = piStatus?.devices?.[visibleDeviceId]?.status?.state
    ?? deviceEntries.find(([, device]) => device?.active_session_id === visibleSessionId)?.[1]?.status?.state
    ?? "";
  const isPiBusy = Boolean(visibleSessionId);
  const ownsVisibleSession = Boolean(activeSessionId && activeSessionId === visibleSessionId);
  const reportedPiPaused = String(visibleDeviceState).toLowerCase() === "paused";
  const isPiPaused = ownsVisibleSession ? Boolean(isPaused) : reportedPiPaused;
  const controlPaused = Boolean(ownsVisibleSession ? isPaused : isPiPaused);
  const activeSessionReadings = visibleSessionId
    ? liveReadings.filter((reading) => reading.sessionId === visibleSessionId)
    : [];
  const hasPiTelemetry = Boolean(
    piConnected &&
    visibleSessionId &&
    !isPiPaused &&
    activeSessionReadings.some(isRealPiReading)
  );
  const hasDemoTelemetry = Boolean(
    isDemoSession &&
    visibleSessionId &&
    !isPaused &&
    activeSessionReadings.some(isRealPiReading)
  );
  const hasLiveTelemetry = hasPiTelemetry || hasDemoTelemetry;
  const fullReadings = hasLiveTelemetry ? activeSessionReadings : [ZERO_READING];

  const profileSpecs = {
    "Surveillance Drone": { cRating: "10", batteryType: "Li-ion", mah: "4500", numCells: "4", voltage: "14.8" },
    "Delivery Heavy Lift": { cRating: "25", batteryType: "LiPo", mah: "22000", numCells: "6", voltage: "22.2" },
    "FPV Racing Drone": { cRating: "95", batteryType: "LiPo", mah: "1300", numCells: "4", voltage: "14.8" },
    "Inspection Quad": { cRating: "15", batteryType: "Li-ion", mah: "8000", numCells: "4", voltage: "14.8" }
  };

  const point = fullReadings.at(-1) ?? ZERO_READING;
  const dashboardConfig = operationMode === "charge"
    ? {
      title: "Charge Configuration",
      fields: [
        ["Battery", batteryName || "Unnamed pack"],
        ["Chemistry", chargeBatteryType],
        ["Mode", "Balance charge"],
        ["Pack voltage", `${chargeVoltage || "0"} V`],
        ["Charge current", `${chargeCurrent || "0"} A`]
      ]
    }
    : {
      title: "Discharge Configuration",
      fields: [
        ["Battery", batteryName || "Unnamed pack"],
        ["Chemistry", batteryType],
        ["Profile", droneProfile],
        ["C Rating", `${cRating || "0"}C`],
        ["Capacity", `${mah || "0"} mAh`],
        ["Cells", `${numCells || "0"}S`],
        ["Pack voltage", `${voltage || "0"} V`]
      ]
    };

  const activeLivePoint = hasLiveTelemetry
    ? {
      ...livePoint,
      ...point,
      soc: Number.isFinite(point.soc) ? point.soc : Math.round(clamp(((point.voltage - 3) / 1.25) * 100, 0, 100)),
      status: point.status ?? livePoint?.status ?? "healthy"
    }
    : {
      ...ZERO_READING,
      mode: livePoint?.mode ?? "IDLE"
    };

  const readings = fullReadings.map((reading, index, list) => {
    const computedSoc = Math.round(clamp(100 - (index / Math.max(1, list.length)) * 75, 0, 100));
    const computedSoh = Number((99.5 - (index / Math.max(1, list.length)) * 4.2).toFixed(2));
    return {
      ...reading,
      soc: hasLiveTelemetry ? (Number.isFinite(reading.soc) ? reading.soc : computedSoc) : 0,
      soh: hasLiveTelemetry ? (Number.isFinite(reading.soh) ? reading.soh : computedSoh) : 0,
      power: Number((reading.voltage * reading.current).toFixed(2)),
      thermalLimit: 38,
      criticalLimit: 45
    };
  });

  const powerValue = activeLivePoint.voltage * activeLivePoint.current;
  const focusedMetricConfig = focusedMetric ? GLOBAL_METRICS.find((metric) => metric.metricKey === focusedMetric) : null;
  const focusedMetricValues = focusedMetric
    ? readings.map((reading) => Number(reading?.[focusedMetric])).filter(Number.isFinite)
    : [];
  const focusedMetricLatest = focusedMetric ? Number(activeLivePoint?.[focusedMetric] ?? readings.at(-1)?.[focusedMetric] ?? 0) : 0;
  const focusedMetricAverage = focusedMetricValues.length
    ? focusedMetricValues.reduce((total, value) => total + value, 0) / focusedMetricValues.length
    : 0;
  const tone = activeLivePoint.status === "critical" ? "danger" : activeLivePoint.status === "warning" ? "warn" : "good";
  const PiStatusIcon = piConnected ? Wifi : WifiOff;
  const piStatusLabel = hasDemoTelemetry
    ? "Demo data running"
    : hasPiTelemetry
    ? "Pi data receiving"
    : isPiPaused
      ? "Pi paused"
      : isPiBusy
        ? "Pi in use"
        : piConnected
          ? "Pi available"
          : "Pi unavailable";
  const piStatusDetail = hasDemoTelemetry
    ? "Pi is unavailable, so bundled demo telemetry is updating the dashboard"
    : hasPiTelemetry
    ? "Live telemetry is updating the dashboard"
    : isPiPaused
      ? "Telemetry is paused for the active session"
      : isPiBusy
        ? `Session ${visibleSessionId} is using ${visibleDeviceId || "the Pi"}`
    : piConnected
      ? "Pi is connected, waiting for telemetry packets"
      : "Waiting for Raspberry Pi telemetry bridge";

  const profileDescriptions = {
    "Surveillance Drone": "Surveillance Drone: Hover, camera sweep, return, and controlled landing",
    "Delivery Heavy Lift": "Delivery Heavy Lift: Payload attachment, high-draw transit, drop-off, return",
    "FPV Racing Drone": "FPV Racing Drone: High-speed gates, maximum output draw, loops, thermal challenge",
    "Inspection Quad": "Inspection Quad: Structural check, steady grid path, high-wind holds, precision landing"
  };

  const buildSessionConfig = () => {
    if (operationMode === "charge") {
      const packVoltage = Number(chargeVoltage) || 11.1;
      const cellCount = Math.max(1, Math.round(packVoltage / 3.7));
      const capacityAh = Math.max(0.5, (Number(chargeCurrent) || 2) * 1);
      return {
        chemistry: chargeBatteryType,
        cell_count: cellCount,
        capacity_ah: capacityAh,
        drone_type: droneProfile,
        discharge_profile: "BALANCE_CHG"
      };
    }

    return {
      chemistry: batteryType,
      cell_count: Number(numCells),
      capacity_ah: Number(mah) / 1000,
      drone_type: droneProfile,
      discharge_profile: "PULSE"
    };
  };

  const handleRun = async () => {
    setSessionError("");
    setSessionPending(true);
    setPendingAction("start");
    try {
      const response = await onStartSession?.({
        battery_id: activeBattery || selectedSession?.batteryId || "B0047",
        battery_name: batteryName,
        config: buildSessionConfig()
      });

      if (!response?.session_id) {
        throw new Error("Backend did not return a session id.");
      }
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not start session.");
    } finally {
      setSessionPending(false);
      setPendingAction("");
    }
  };

  const handlePause = async () => {
    if (!activeSessionId) return;
    const nextPaused = !controlPaused;
    setSessionError("");
    setSessionPending(true);
    setPendingAction(nextPaused ? "pause" : "resume");
    try {
      await onPauseSession?.(activeSessionId, nextPaused, activeDeviceId);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not pause session.");
    } finally {
      setSessionPending(false);
      setPendingAction("");
    }
  };

  const handleStop = async () => {
    setSessionError("");
    setSessionPending(true);
    setPendingAction("stop");
    try {
      if (activeSessionId) {
        await onEndSession?.(activeSessionId);
      }
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not end session.");
    } finally {
      setSessionPending(false);
      setPendingAction("");
    }
  };

  const handleExportDashboardPdf = () => {
    const reportReadings = hasLiveTelemetry
      ? readings
      : (selectedSession?.readings?.length ? selectedSession.readings : readings);
    const latestReportPoint = reportReadings.at(-1) ?? activeLivePoint;
    const reportStatus = activeSessionId
      ? (controlPaused ? "Paused" : "Running")
      : selectedSession?.status
        ? selectedSession.status
        : "Snapshot";
    const generatedAt = new Date();
    const configRows = dashboardConfig.fields
      .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
      .join("");
    const metricRows = [
      ["Voltage", `${formatReportNumber(latestReportPoint.voltage)} V`],
      ["Current", `${formatReportNumber(latestReportPoint.current)} A`],
      ["Temperature", `${formatReportNumber(latestReportPoint.temperature, 1)} C`],
      ["SOC", `${formatReportNumber(latestReportPoint.soc, 0)}%`],
      ["SOH", `${formatReportNumber(latestReportPoint.soh, 1)}%`],
      ["Power", `${formatReportNumber((latestReportPoint.voltage ?? 0) * (latestReportPoint.current ?? 0), 1)} W`]
    ].map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join("");
    const reportChartHtml = GLOBAL_METRICS
      .map((metric) => buildReportLineChart(reportReadings, metric.metricKey, metric.title, metric.unit, metric.color))
      .join("");
    const measurementRows = reportReadings.map((row, index) => `
      <tr>
        <td>${escapeHtml(row.timestamp ? new Date(row.timestamp).toLocaleString() : `T+${Math.round(row.time ?? index)}s`)}</td>
        <td>${formatReportNumber(row.voltage)}</td>
        <td>${formatReportNumber(row.current)}</td>
        <td>${formatReportNumber(row.temperature, 1)}</td>
        <td>${formatReportNumber(row.soc, 0)}</td>
        <td>${formatReportNumber(row.soh, 1)}</td>
        <td>${formatReportNumber(row.power ?? ((row.voltage ?? 0) * (row.current ?? 0)), 1)}</td>
      </tr>
    `).join("");

    const reportWindow = window.open("", "_blank", "width=980,height=1200");
    if (!reportWindow) {
      window.alert("Allow pop-ups for this site to export the dashboard PDF.");
      return;
    }

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>PowerProbe Dashboard Report</title>
          <style>
            @page { size: A4; margin: 16mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; line-height: 1.45; }
            .report { display: grid; gap: 18px; }
            .report-header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 3px solid #1d4ed8; padding-bottom: 14px; }
            .brand { font-size: 24px; font-weight: 800; color: #0f172a; }
            .subtitle { margin-top: 4px; color: #475569; font-size: 13px; }
            .meta { text-align: right; font-size: 12px; color: #475569; }
            .status-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
            .status-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; }
            .status-card span { display: block; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; }
            .status-card strong { display: block; margin-top: 4px; color: #111827; font-size: 14px; }
            h2 { margin: 0 0 8px; font-size: 15px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #dbe3ef; padding: 8px; text-align: left; }
            th { background: #eff6ff; color: #1e3a8a; font-weight: 800; }
            td { color: #111827; }
            .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
            .section { break-inside: avoid; }
            .report-charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .report-chart-card { break-inside: avoid; border: 1px solid #dbe3ef; border-radius: 8px; padding: 10px; }
            .report-chart-head { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 6px; font-size: 12px; }
            .report-chart-head strong { color: #0f172a; }
            .report-chart-head span { color: #64748b; }
            .report-chart-card svg { width: 100%; height: auto; display: block; }
            .report-chart-card line { stroke: #cbd5e1; stroke-width: 1; }
            .report-chart-card polyline { fill: none; stroke-width: 2.4; }
            .report-chart-card text { fill: #475569; font-size: 11px; font-weight: 700; }
            .report-chart-empty { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; color: #64748b; }
            .measurements-table { font-size: 10px; }
            .measurements-table th,
            .measurements-table td { padding: 5px 6px; }
            .note { padding: 10px 12px; border-left: 4px solid #1d4ed8; background: #eff6ff; color: #1e3a8a; font-size: 12px; }
            .footer { border-top: 1px solid #cbd5e1; padding-top: 10px; color: #64748b; font-size: 11px; }
            @media print { .report-charts-grid { grid-template-columns: 1fr 1fr; } }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <main class="report">
            <header class="report-header">
              <div>
                <div class="brand">PowerProbe Dashboard Report</div>
                <div class="subtitle">Battery telemetry, operational state, and configuration snapshot</div>
              </div>
              <div class="meta">
                <div>Generated: ${escapeHtml(generatedAt.toLocaleString())}</div>
                <div>Report Type: Dashboard PDF Export</div>
              </div>
            </header>

            <section class="status-strip">
              <div class="status-card"><span>Session</span><strong>${escapeHtml(visibleSessionId || selectedSession?.sessionId || "No active session")}</strong></div>
              <div class="status-card"><span>Status</span><strong>${escapeHtml(reportStatus)}</strong></div>
              <div class="status-card"><span>Battery</span><strong>${escapeHtml(activeBattery || selectedSession?.batteryId || "Unknown")}</strong></div>
              <div class="status-card"><span>Source</span><strong>${escapeHtml(hasPiTelemetry ? "Raspberry Pi" : hasDemoTelemetry ? "Demo fallback" : selectedSession?.sourceFile || "Dashboard snapshot")}</strong></div>
            </section>

            <section class="two-col">
              <div class="section">
                <h2>Applied Configuration</h2>
                <table>${configRows}</table>
              </div>
              <div class="section">
                <h2>Latest Measurements</h2>
                <table>${metricRows}</table>
              </div>
            </section>

            <section class="section">
              <h2>Dashboard Charts</h2>
              <div class="report-charts-grid">${reportChartHtml}</div>
            </section>

            <section class="section">
              <h2>All Measurements To Download Time</h2>
              <table class="measurements-table">
                <thead>
                  <tr><th>Time</th><th>Voltage (V)</th><th>Current (A)</th><th>Temp (C)</th><th>SOC (%)</th><th>SOH (%)</th><th>Power (W)</th></tr>
                </thead>
                <tbody>${measurementRows || `<tr><td colspan="7">No telemetry samples available.</td></tr>`}</tbody>
              </table>
            </section>

            <p class="note">This report is generated from the current PowerProbe dashboard state. Validate SOC, SOH, and RUL indicators against approved battery models before production use.</p>
            <footer class="footer">PowerProbe | Team 6 | Internal battery analytics report</footer>
          </main>
          <script>
            window.onload = () => {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  return (
    <section className="dashboard-page">
      <div className="dashboard-top-section">
        <div className="dashboard-title-area">
          <h1>Live Battery Dashboard</h1>
          <p>Monitor live battery telemetry and performance metrics in real-time</p>
          <span className={`operation-mode-badge mode-${operationMode}`}>
            {operationMode === "charge" ? "Charge cycle" : "Discharge cycle"}
          </span>
        </div>

        <div className="dashboard-action-buttons">
          <button
            className="btn-configuration"
            onClick={() => setChargeModalOpen(true)}
            title="Open configuration settings"
            type="button"
          >
            <Settings size={18} />
            Configuration
          </button>

          {isRunning && activeSessionId && (
            <button
              className="btn-export-pdf"
              onClick={handleExportDashboardPdf}
              title="Export dashboard report as PDF"
              type="button"
            >
              <FileText size={18} />
              Export PDF
            </button>
          )}

          <button
            className={`btn-run ${isRunning && !controlPaused ? "active" : ""}`}
            onClick={handleRun}
            disabled={sessionPending || Boolean(activeSessionId) || isPiBusy}
            type="button"
          >
            <Play size={16} fill="currentColor" />
            {pendingAction === "start" ? "Starting..." : isPiBusy && !ownsVisibleSession ? "Pi busy" : "Run"}
          </button>

          <button
            className={`btn-pause ${controlPaused ? "active" : ""}`}
            onClick={handlePause}
            disabled={sessionPending || !ownsVisibleSession}
            type="button"
          >
            <Pause size={16} />
            {pendingAction === "pause" ? "Pausing..." : pendingAction === "resume" ? "Resuming..." : controlPaused ? "Resume" : "Pause"}
          </button>

          <button
            className="btn-stop"
            onClick={handleStop}
            disabled={sessionPending || !ownsVisibleSession}
            type="button"
          >
            <Square size={16} fill="currentColor" />
            {pendingAction === "stop" ? "Stopping..." : "Stop"}
          </button>
        </div>
      </div>

      {sessionError && (
        <div className="session-error">
          <p>{sessionError}</p>
        </div>
      )}

      {visibleSessionId && (
        <div className="session-info">
          <p>{ownsVisibleSession ? "Active session" : "Pi in use"}: <strong>{visibleSessionId}</strong></p>
        </div>
      )}

      <section className="dashboard-config-summary">
        <div>
          <p className="dashboard-config-eyebrow">Applied setup</p>
          <h2>{dashboardConfig.title}</h2>
        </div>
        <div className="dashboard-config-grid">
          {dashboardConfig.fields.map(([label, value]) => (
            <div className="dashboard-config-item" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={`pi-status-banner ${piConnected ? "connected" : "unavailable"}`} aria-label="Raspberry Pi connection status">
        <div className="pi-status-main">
          <PiStatusIcon size={22} aria-hidden="true" />
          <div>
            <strong>{piStatusLabel}</strong>
            <span>{piStatusDetail}</span>
          </div>
        </div>
      </section>

      <div className="instrument-panel-header section-toggle-head">
        <div>
          <h2>Instrument Panel</h2>
          <p>Live battery telemetry diagnostics</p>
        </div>
        <div className="section-header-actions">
          <span className={`status-badge ${activeLivePoint.status}`}>{statusLabel[activeLivePoint.status]}</span>
          <button
            className="section-hide-button"
            type="button"
            onClick={() => setInstrumentHidden((hidden) => !hidden)}
            aria-expanded={!instrumentHidden}
            title={instrumentHidden ? "Show instrument panel" : "Hide instrument panel"}
          >
            {instrumentHidden ? <Eye size={16} /> : <EyeOff size={16} />}
            {instrumentHidden ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {!instrumentHidden && (
        <>
      <div className="metrics-row">
        <MetricCard icon={Zap} label="Voltage" value={`${activeLivePoint.voltage.toFixed(2)} V`} detail="active bus" tone="good" />
        <MetricCard icon={Activity} label="Current" value={`${activeLivePoint.current.toFixed(2)} A`} detail="realtime draw" tone="good" />
        <MetricCard icon={Flame} label="Temperature" value={`${activeLivePoint.temperature.toFixed(1)} °C`} detail="thermal state" tone={tone} />
      </div>

      <div className="metrics-row">
        <MetricCard icon={BatteryFull} label="SOC" value={`${(readings[readings.length - 1]?.soc ?? 100)}%`} detail="charge level" tone="good" />
        <MetricCard icon={Gauge} label="SOH" value={`${(readings[readings.length - 1]?.soh ?? 100.0).toFixed(1)}%`} detail="health status" tone="good" />
        <MetricCard icon={Zap} label="Power" value={`${powerValue.toFixed(1)} W`} detail="power draw" tone="good" />
      </div>
        </>
      )}

      <section className="global-charts-section">
        <div className="global-charts-head section-toggle-head">
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <h2>Global Telemetry</h2>
            {!hasLiveTelemetry && <span className="demo-badge">Waiting for Pi data</span>}
          </div>
          <div className="section-header-actions">
            <p>Six live charts — axes adapt to {operationMode} operating range</p>
            <button
              className="section-hide-button"
              type="button"
              onClick={() => setGlobalChartsHidden((hidden) => !hidden)}
              aria-expanded={!globalChartsHidden}
              title={globalChartsHidden ? "Show global telemetry charts" : "Hide global telemetry charts"}
            >
              {globalChartsHidden ? <Eye size={16} /> : <EyeOff size={16} />}
              {globalChartsHidden ? "Show" : "Hide"}
            </button>
          </div>
        </div>

        {!globalChartsHidden && (
          <>
        <div className="global-chart-toolbar" aria-label="Global chart type">
          <span>Global chart type</span>
          <div className="global-chart-buttons">
            {GLOBAL_CHART_TYPES.map((type) => (
              <button
                key={type.key}
                type="button"
                className={globalChartType === type.key ? "active" : ""}
                onClick={() => {
                  setGlobalChartType(type.key);
                  setGlobalChartVersion((version) => version + 1);
                }}
              >
                {type.label}
              </button>
            ))}
          </div>
          {focusedMetric && (
            <button className="clear-focused-chart" type="button" onClick={() => setFocusedMetric("")}>
              Show all charts
            </button>
          )}
        </div>

        {focusedMetricConfig && (
          <section className="focused-metric-panel" aria-label={`${focusedMetricConfig.title} focused reading`}>
            <div>
              <span>Focused metric</span>
              <strong>{focusedMetricConfig.title}</strong>
            </div>
            <div>
              <span>Live reading</span>
              <strong>{formatReportNumber(focusedMetricLatest, focusedMetric === "soc" ? 0 : focusedMetric === "soh" || focusedMetric === "temperature" ? 1 : 2)} {focusedMetricConfig.unit}</strong>
            </div>
            <div>
              <span>Average in run</span>
              <strong>{formatReportNumber(focusedMetricAverage, focusedMetric === "soc" ? 0 : focusedMetric === "soh" || focusedMetric === "temperature" ? 1 : 2)} {focusedMetricConfig.unit}</strong>
            </div>
            <button className="clear-focused-chart" type="button" onClick={() => setFocusedMetric("")}>
              Exit focused view
            </button>
          </section>
        )}

        <div className={`chart-row-two-cols ${focusedMetric ? "focused-chart-grid" : ""}`}>
          {(!focusedMetric || focusedMetric === "voltage") && (
          <TelemetryChartCard
            title="Voltage Trend"
            metricKey="voltage"
            unit="V"
            data={readings}
            operationMode={operationMode}
            compact
            showToggles
            controlledChartType={`${globalChartType}:${globalChartVersion}`}
            onSelectChart={(metric) => setFocusedMetric((current) => current === metric ? "" : metric)}
            focused={focusedMetric === "voltage"}
          />
          )}
          {(!focusedMetric || focusedMetric === "current") && (
          <TelemetryChartCard
            title="Current Load"
            metricKey="current"
            unit="A"
            data={readings}
            operationMode={operationMode}
            compact
            showToggles
            controlledChartType={`${globalChartType}:${globalChartVersion}`}
            onSelectChart={(metric) => setFocusedMetric((current) => current === metric ? "" : metric)}
            focused={focusedMetric === "current"}
          />
          )}
        </div>

        <div className={`chart-row-two-cols ${focusedMetric ? "focused-chart-grid" : ""}`}>
          {(!focusedMetric || focusedMetric === "temperature") && (
          <TelemetryChartCard
            title="Thermal Profile"
            metricKey="temperature"
            unit="°C"
            data={readings}
            operationMode={operationMode}
            compact
            showToggles
            controlledChartType={`${globalChartType}:${globalChartVersion}`}
            onSelectChart={(metric) => setFocusedMetric((current) => current === metric ? "" : metric)}
            focused={focusedMetric === "temperature"}
          />
          )}
          {(!focusedMetric || focusedMetric === "power") && (
          <TelemetryChartCard
            title="Power Consumption"
            metricKey="power"
            unit="W"
            data={readings}
            operationMode={operationMode}
            compact
            showToggles
            controlledChartType={`${globalChartType}:${globalChartVersion}`}
            onSelectChart={(metric) => setFocusedMetric((current) => current === metric ? "" : metric)}
            focused={focusedMetric === "power"}
          />
          )}
        </div>

        <div className={`chart-row-two-cols ${focusedMetric ? "focused-chart-grid" : ""}`}>
          {(!focusedMetric || focusedMetric === "soc") && (
          <TelemetryChartCard
            title="State of Charge"
            metricKey="soc"
            unit="%"
            data={readings}
            forceYRange={{ min: 0, max: 100 }}
            operationMode={operationMode}
            compact
            showToggles
            controlledChartType={`${globalChartType}:${globalChartVersion}`}
            onSelectChart={(metric) => setFocusedMetric((current) => current === metric ? "" : metric)}
            focused={focusedMetric === "soc"}
          />
          )}
          {(!focusedMetric || focusedMetric === "soh") && (
          <TelemetryChartCard
            title="State of Health"
            metricKey="soh"
            unit="%"
            data={readings}
            forceYRange={{ min: 0, max: 100 }}
            operationMode={operationMode}
            compact
            showToggles
            controlledChartType={`${globalChartType}:${globalChartVersion}`}
            onSelectChart={(metric) => setFocusedMetric((current) => current === metric ? "" : metric)}
            focused={focusedMetric === "soh"}
          />
          )}
        </div>
          </>
        )}
      </section>

      <CustomChartBuilder data={readings} operationMode={operationMode} />

      <ConfigurationModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onApply={() => setConfigModalOpen(false)}
        cRating={cRating}
        batteryType={batteryType}
        mah={mah}
        numCells={numCells}
        voltage={voltage}
        droneProfile={droneProfile}
        onCRatingChange={setCRating}
        onBatteryTypeChange={setBatteryType}
        onMahChange={setMah}
        onNumCellsChange={setNumCells}
        onVoltageChange={setVoltage}
        onDroneProfileChange={setDroneProfile}
        profiles={profiles}
        batteryName={batteryName}
        onBatteryNameChange={setBatteryName}
        profileSpecs={profileSpecs}
        profileDescriptions={profileDescriptions}
        userId={userId}
      />

      <ChargeConfigurationModal
        isOpen={chargeConfigModalOpen}
        onClose={() => setChargeConfigModalOpen(false)}
        onApply={() => setChargeConfigModalOpen(false)}
        batteryType={chargeBatteryType}
        voltage={chargeVoltage}
        chargeCurrent={chargeCurrent}
        batteryName={batteryName}
        onBatteryTypeChange={setChargeBatteryType}
        onVoltageChange={setChargeVoltage}
        onChargeCurrentChange={setChargeCurrent}
        onBatteryNameChange={setBatteryName}
        userId={userId}
      />

      <ChargeDischargeModal
        isOpen={chargeModalOpen}
        onClose={() => setChargeModalOpen(false)}
        onSelect={(mode) => {
          setChargeModalOpen(false);
          setOperationMode(mode);
          if (mode === "discharge") {
            setConfigModalOpen(true);
          } else if (mode === "charge") {
            setChargeConfigModalOpen(true);
          }
        }}
      />
    </section>
  );
}

export default Dashboard;
