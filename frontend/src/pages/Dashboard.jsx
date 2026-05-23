import { useState } from "react";
import { Activity, Flame, Gauge, Play, Pause, Square, Zap, BatteryFull, Settings } from "lucide-react";
import MetricCard from "../components/MetricCard";
import TelemetryChartCard from "../components/TelemetryChartCard";
import ConfigurationModal from "../components/ConfigurationModal";
import ChargeConfigurationModal from "../components/ChargeConfigurationModal";
import ChargeDischargeModal from "../components/ChargeDischargeModal";
import CustomChartBuilder from "../components/CustomChartBuilder";
import { clamp } from "../lib/battery";

import demoData from "../demo-data.json";

const SOH_EOL_PERCENT = 80;
const DESIGN_CYCLE_LIFE = 500;

function getTemperatureStatus(temperature) {
  if (temperature >= 45) return { status: "critical", tone: "danger", label: "Critical >= 45 C" };
  if (temperature >= 38) return { status: "warning", tone: "warn", label: "Warning >= 38 C" };
  return { status: "healthy", tone: "good", label: "Normal < 38 C" };
}

function getElapsedSeconds(current, previous) {
  if (!previous) return 0;
  const timeDelta = Number(current.time) - Number(previous.time);
  if (Number.isFinite(timeDelta) && timeDelta >= 0) return timeDelta;

  const currentMs = new Date(current.timestamp).getTime();
  const previousMs = new Date(previous.timestamp).getTime();
  if (Number.isFinite(currentMs) && Number.isFinite(previousMs)) {
    return Math.max(0, (currentMs - previousMs) / 1000);
  }

  return 1;
}

function calculateDerivedReadings(sourceReadings, { capacityAh, operationMode, completedCycles = 1 }) {
  let soc = 100;
  let cycleDischargeAh = 0;
  let measuredCapacityAh = capacityAh;

  return sourceReadings.map((reading, index, list) => {
    const previous = list[index - 1];
    const dt = getElapsedSeconds(reading, previous);
    const rawCurrent = Number(reading.current) || 0;
    const dischargeCurrent = operationMode === "charge" ? -Math.abs(rawCurrent) : Math.abs(rawCurrent);

    if (Number.isFinite(reading.soc)) {
      soc = reading.soc;
    } else if (capacityAh > 0 && dt > 0) {
      soc = clamp(soc - ((dischargeCurrent * dt) / (3600 * capacityAh)) * 100, 0, 100);
    }

    if (dischargeCurrent > 0 && dt > 0) {
      cycleDischargeAh += (dischargeCurrent * dt) / 3600;
    }

    if (cycleDischargeAh > 0) {
      measuredCapacityAh = (0.2 * cycleDischargeAh) + (0.8 * measuredCapacityAh);
    }

    const soh = Number.isFinite(reading.soh)
      ? reading.soh
      : clamp((measuredCapacityAh / capacityAh) * 100, 0, 100);
    const sohDrop = Math.max(0, 100 - soh);
    const degradationPerCycle = completedCycles >= 5 && sohDrop > 0
      ? sohDrop / completedCycles
      : (100 - SOH_EOL_PERCENT) / DESIGN_CYCLE_LIFE;
    const rul = Number.isFinite(reading.rul)
      ? reading.rul
      : soh <= SOH_EOL_PERCENT ? 0 : Math.max(0, (soh - SOH_EOL_PERCENT) / degradationPerCycle);

    return {
      ...reading,
      soc: Number(soc.toFixed(1)),
      soh: Number(soh.toFixed(1)),
      rul: Number(rul.toFixed(1)),
      power: Number((reading.voltage * reading.current).toFixed(2)),
      thermalLimit: 38,
      criticalLimit: 45
    };
  });
}

function Dashboard({ livePoint, liveStream, selectedSession, activeBattery, profiles = [], onStartSession, onEndSession, onPauseSession, piConnected = false }) {
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

  const sessionReadings = selectedSession?.readings?.length > 0 ? selectedSession.readings : null;
  const fullReadings = sessionReadings ?? ((!useDemo && (liveStream?.length > 0)) ? liveStream : demoReadings);
  const usingDemo = fullReadings === demoReadings;

  const profileSpecs = {
    "Surveillance Drone": { cRating: "10", batteryType: "Li-ion", mah: "4500", numCells: "4", voltage: "14.8" },
    "Delivery Heavy Lift": { cRating: "25", batteryType: "LiPo", mah: "22000", numCells: "6", voltage: "22.2" },
    "FPV Racing Drone": { cRating: "95", batteryType: "LiPo", mah: "1300", numCells: "4", voltage: "14.8" },
    "Inspection Quad": { cRating: "15", batteryType: "Li-ion", mah: "8000", numCells: "4", voltage: "14.8" }
  };

  const point = fullReadings.at(-1) ?? fullReadings[0] ?? livePoint;
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

  const ratedCapacityAh = operationMode === "charge"
    ? Math.max(0.1, Number(chargeCurrent) || 2.2)
    : Math.max(0.1, (Number(mah) || 2200) / 1000);
  const readings = calculateDerivedReadings(fullReadings, {
    capacityAh: ratedCapacityAh,
    operationMode,
    completedCycles: Number(selectedSession?.completedCycles) || 1
  });
  const latestReading = readings.at(-1) ?? readings[0] ?? point;
  const temperatureStatus = getTemperatureStatus(Number(latestReading.temperature) || 0);
  const activeLivePoint = {
    ...livePoint,
    ...latestReading,
    status: temperatureStatus.status
  };

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
        battery_name: batteryName,
        config: buildSessionConfig()
      });

      setActiveSessionId(response?.session_id ?? "");
      setIsRunning(true);
      setUseDemo(!response?.command_sent);
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

      <div className="instrument-panel-header">
        <div>
          <h2>Instrument Panel</h2>
          <p>Live battery telemetry diagnostics</p>
        </div>
      </div>

      <div className="metrics-row">
        <MetricCard icon={Zap} label="Voltage" value={`${activeLivePoint.voltage.toFixed(2)} V`} detail="active bus" tone="good" />
        <MetricCard icon={Activity} label="Current" value={`${activeLivePoint.current.toFixed(2)} A`} detail="realtime draw" tone="good" />
        <MetricCard icon={Flame} label="Temperature" value={`${activeLivePoint.temperature.toFixed(1)} C`} detail={temperatureStatus.label} tone={temperatureStatus.tone} />
      </div>

      <div className="metrics-row">
        <MetricCard icon={BatteryFull} label="SOC" value={`${(latestReading?.soc ?? 100).toFixed(1)}%`} detail="coulomb counting" tone="good" />
        <MetricCard icon={Gauge} label="SOH" value={`${(latestReading?.soh ?? 100.0).toFixed(1)}%`} detail="capacity estimate" tone="good" />
        <MetricCard icon={Gauge} label="RUL" value={`${Math.round(latestReading?.rul ?? 0)} cycles`} detail="to 80% SOH" tone="good" />
      </div>

      <section className="global-charts-section">
        <div className="global-charts-head">
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <h2>Global Telemetry</h2>
            {usingDemo && <span className="demo-badge">{piConnected ? "Demo data" : "Mock data"}</span>}
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
