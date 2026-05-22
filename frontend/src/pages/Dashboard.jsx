import { useState, useEffect } from "react";
import { Activity, Flame, Gauge, Play, Pause, Square, Zap, BatteryFull, Settings } from "lucide-react";
import MetricCard from "../components/MetricCard";
import TelemetryChartCard from "../components/TelemetryChartCard";
import ConfigurationModal from "../components/ConfigurationModal";
import ChargeConfigurationModal from "../components/ChargeConfigurationModal";
import ChargeDischargeModal from "../components/ChargeDischargeModal";
import CustomChartBuilder from "../components/CustomChartBuilder";
import { statusLabel } from "../data/appConfig";
import { clamp } from "../lib/battery";

import demoData from "../demo-data.json";

function Dashboard({ livePoint, liveStream, selectedSession, activeBattery, profiles = [], onStartSession, onEndSession, onPauseSession }) {
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

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [sessionPending, setSessionPending] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [batteryName, setBatteryName] = useState("");
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [useDemo, setUseDemo] = useState(true);

  const demoReadings = (demoData?.testSessions?.[0]?.readings ?? []).map((r) => ({
    time: r.time ?? 0,
    voltage: Number(r.voltage) || 0,
    current: Number(r.current) || 0,
    temperature: Number(r.temperature) || 0
  }));

  const fullReadings = selectedSession?.readings ?? ((!useDemo && (liveStream?.length > 0)) ? liveStream : demoReadings);
  const usingDemo = fullReadings === demoReadings;

  const profileSpecs = {
    "Surveillance Drone": { cRating: "10", batteryType: "Li-ion", mah: "4500", numCells: "4", voltage: "14.8" },
    "Delivery Heavy Lift": { cRating: "25", batteryType: "LiPo", mah: "22000", numCells: "6", voltage: "22.2" },
    "FPV Racing Drone": { cRating: "95", batteryType: "LiPo", mah: "1300", numCells: "4", voltage: "14.8" },
    "Inspection Quad": { cRating: "15", batteryType: "Li-ion", mah: "8000", numCells: "4", voltage: "14.8" }
  };

  useEffect(() => {
    if (operationMode !== "discharge") return;
    const specs = profileSpecs[droneProfile];
    if (specs) {
      setCRating(specs.cRating);
      setBatteryType(specs.batteryType);
      setMah(specs.mah);
      setNumCells(specs.numCells);
      setVoltage(specs.voltage);
    }
  }, [droneProfile, operationMode]);

  const point = fullReadings.at(-1) ?? fullReadings[0] ?? livePoint;

  const activeLivePoint = {
    ...livePoint,
    ...point,
    soc: Math.round(clamp(((point.voltage - 3) / 1.25) * 100, 0, 100)),
    status: point.temperature >= 45 ? "critical" : point.temperature >= 38 ? "warning" : livePoint.status
  };

  const readings = fullReadings.map((reading, index, list) => {
    const computedSoc = Math.round(clamp(100 - (index / Math.max(1, list.length)) * 75, 0, 100));
    const computedSoh = Number((99.5 - (index / Math.max(1, list.length)) * 4.2).toFixed(2));
    return {
      ...reading,
      soc: computedSoc,
      soh: computedSoh,
      power: Number((reading.voltage * reading.current).toFixed(2)),
      thermalLimit: 38,
      criticalLimit: 45
    };
  });

  const powerValue = activeLivePoint.voltage * activeLivePoint.current;
  const tone = activeLivePoint.status === "critical" ? "danger" : activeLivePoint.status === "warning" ? "warn" : "good";

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
    try {
      const response = await onStartSession?.({
        battery_id: activeBattery || selectedSession?.batteryId || "B0047",
        config: buildSessionConfig()
      });

      setActiveSessionId(response?.session_id ?? "");
      setIsRunning(true);
      setUseDemo(false);
      setIsPaused(false);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not start session.");
    } finally {
      setSessionPending(false);
    }
  };

  const handlePause = async () => {
    if (!activeSessionId) return;
    const nextPaused = !isPaused;
    setSessionError("");
    setSessionPending(true);
    try {
      await onPauseSession?.(activeSessionId, nextPaused);
      setIsPaused(nextPaused);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not pause session.");
    } finally {
      setSessionPending(false);
    }
  };

  const handleStop = async () => {
    setSessionError("");
    setSessionPending(true);
    try {
      if (activeSessionId) {
        await onEndSession?.(activeSessionId);
      }
      setActiveSessionId("");
      setIsRunning(false);
      setIsPaused(false);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not end session.");
    } finally {
      setSessionPending(false);
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
            className={`btn-run ${isRunning && !isPaused ? "active" : ""}`}
            onClick={handleRun}
            disabled={sessionPending}
            type="button"
          >
            <Play size={16} fill="currentColor" />
            {sessionPending ? "Starting..." : "Run"}
          </button>

          <button
            className={`btn-pause ${isPaused ? "active" : ""}`}
            onClick={handlePause}
            disabled={sessionPending || !activeSessionId}
            type="button"
          >
            <Pause size={16} />
            Pause
          </button>

          <button
            className="btn-stop"
            onClick={handleStop}
            disabled={sessionPending || (!isRunning && !activeSessionId)}
            type="button"
          >
            <Square size={16} fill="currentColor" />
            Stop
          </button>
        </div>
      </div>

      {sessionError && (
        <div className="session-error">
          <p>{sessionError}</p>
        </div>
      )}

      {activeSessionId && (
        <div className="session-info">
          <p>Active session: <strong>{activeSessionId}</strong></p>
        </div>
      )}

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
            {usingDemo && <span className="demo-badge">Demo data</span>}
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
