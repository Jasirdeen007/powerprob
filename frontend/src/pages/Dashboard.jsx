import { useState } from "react";
import { Activity, Flame, Gauge, Play, Pause, Square, Zap, BatteryFull, Settings, Wifi, WifiOff } from "lucide-react";
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

function isRealPiReading(reading) {
  if (!reading) return false;
  if (reading.timestamp) return true;
  return [reading.voltage, reading.current, reading.temperature].some((value) => Number(value) !== 0);
}

function Dashboard({ livePoint, liveStream, selectedSession, activeBattery, activeSession = {}, profiles = [], onStartSession, onEndSession, onPauseSession, piStatus }) {
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

      <div className="instrument-panel-header">
        <div>
          <h2>Instrument Panel</h2>
          <p>Live battery telemetry diagnostics</p>
        </div>
        <div className="header-status">
          <span className={`status-badge ${activeLivePoint.status}`}>{statusLabel[activeLivePoint.status]}</span>
        </div>
      </div>

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

      <section className="global-charts-section">
        <div className="global-charts-head">
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <h2>Global Telemetry</h2>
            {!hasPiTelemetry && <span className="demo-badge">Waiting for Pi data</span>}
          </div>
          <p>Six live charts — axes adapt to {operationMode} operating range</p>
        </div>

        <div className="chart-row-two-cols">
          <TelemetryChartCard
            title="Voltage Trend"
            metricKey="voltage"
            unit="V"
            data={readings}
            operationMode={operationMode}
            compact
            showToggles
          />
          <TelemetryChartCard
            title="Current Load"
            metricKey="current"
            unit="A"
            data={readings}
            operationMode={operationMode}
            compact
            showToggles
          />
        </div>

        <div className="chart-row-two-cols">
          <TelemetryChartCard
            title="Thermal Profile"
            metricKey="temperature"
            unit="°C"
            data={readings}
            operationMode={operationMode}
            compact
            showToggles
          />
          <TelemetryChartCard
            title="Power Consumption"
            metricKey="power"
            unit="W"
            data={readings}
            operationMode={operationMode}
            compact
            showToggles
          />
        </div>

        <div className="chart-row-two-cols">
          <TelemetryChartCard
            title="State of Charge"
            metricKey="soc"
            unit="%"
            data={readings}
            forceYRange={{ min: 0, max: 100 }}
            operationMode={operationMode}
            compact
            showToggles
          />
          <TelemetryChartCard
            title="State of Health"
            metricKey="soh"
            unit="%"
            data={readings}
            forceYRange={{ min: 0, max: 100 }}
            operationMode={operationMode}
            compact
            showToggles
          />
        </div>
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
