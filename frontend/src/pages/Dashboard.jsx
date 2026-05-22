import { useState, useEffect } from "react";
import { Activity, Flame, Gauge, Play, Pause, Square, Zap, BatteryFull, Settings, Search, Plus } from "lucide-react";
import MetricCard from "../components/MetricCard";
import TelemetryChartCard from "../components/TelemetryChartCard";
import ConfigurationModal from "../components/ConfigurationModal";
import CustomAxisConfig from "../components/CustomAxisConfig";
import ChargeDischargeModal from "../components/ChargeDischargeModal";
import VariableComparisonSelector from "../components/VariableComparisonSelector";
import { statusLabel } from "../data/appConfig";
import { clamp } from "../lib/battery";

function Dashboard({ livePoint, liveStream, selectedSession, activeBattery, profiles = [], onStartSession, onEndSession, onPauseSession }) {
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [cRating, setCRating] = useState("25");
  const [batteryType, setBatteryType] = useState("Li-ion");
  const [mah, setMah] = useState("2200");
  const [numCells, setNumCells] = useState("3");
  const [voltage, setVoltage] = useState("11.1");
  const [droneProfile, setDroneProfile] = useState("Surveillance Drone");

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [sessionPending, setSessionPending] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [customAxisLabels, setCustomAxisLabels] = useState({});
  const [batteryName, setBatteryName] = useState("");
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonConfig, setComparisonConfig] = useState(null);

  const fullReadings = liveStream.length > 0 ? liveStream : selectedSession?.readings ?? [];

  const profileSpecs = {
    "Surveillance Drone": { cRating: "10", batteryType: "Li-ion", mah: "4500", numCells: "4", voltage: "14.8" },
    "Delivery Heavy Lift": { cRating: "25", batteryType: "LiPo", mah: "22000", numCells: "6", voltage: "22.2" },
    "FPV Racing Drone": { cRating: "95", batteryType: "LiPo", mah: "1300", numCells: "4", voltage: "14.8" },
    "Inspection Quad": { cRating: "15", batteryType: "Li-ion", mah: "8000", numCells: "4", voltage: "14.8" }
  };

  useEffect(() => {
    const specs = profileSpecs[droneProfile];
    if (specs) {
      setCRating(specs.cRating);
      setBatteryType(specs.batteryType);
      setMah(specs.mah);
      setNumCells(specs.numCells);
      setVoltage(specs.voltage);
    }
  }, [droneProfile]);

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

  const profileOptions = profiles.length > 0
    ? profiles.map((profile) => ({ value: profile.name, label: profile.name }))
    : Object.keys(profileSpecs).map((name) => ({ value: name, label: name }));

  const handleRun = async () => {
    setSessionError("");
    setSessionPending(true);
    try {
      const response = await onStartSession?.({
        battery_id: activeBattery || selectedSession?.batteryId || "B0047",
        config: {
          chemistry: batteryType,
          cell_count: Number(numCells),
          capacity_ah: Number(mah) / 1000,
          drone_type: droneProfile,
          discharge_profile: "PULSE"
        }
      });

      setActiveSessionId(response?.session_id ?? "");
      setIsRunning(true);
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

  const handleConfigurationApply = () => {
    setConfigModalOpen(false);
  };

  return (
    <>
      <div className="dashboard-top-section">
        <div className="dashboard-title-area">
          <h1>Live Battery Dashboard</h1>
          <p>Monitor live battery telemetry and performance metrics in real-time</p>
        </div>

        <div className="dashboard-action-buttons">
          <button
            className="btn-configuration"
            onClick={() => setChargeModalOpen(true)}
            title="Open configuration settings"
          >
            <Settings size={18} />
            Configuration
          </button>
          <button
            className="btn-compare"
            onClick={() => setComparisonOpen(true)}
            title="Compare variables"
            style={{ marginLeft: 8 }}
          >
            <Plus size={14} />
            Compare
          </button>
          
          <button
            className={`btn-run ${isRunning && !isPaused ? "active" : ""}`}
            onClick={handleRun}
            disabled={sessionPending}
          >
            <Play size={16} fill="currentColor" />
            {sessionPending ? "Starting..." : "Run"}
          </button>

          <button
            className={`btn-pause ${isPaused ? "active" : ""}`}
            onClick={handlePause}
            disabled={sessionPending || !activeSessionId}
          >
            <Pause size={16} />
            Pause
          </button>

          <button
            className="btn-stop"
            onClick={handleStop}
            disabled={sessionPending || (!isRunning && !activeSessionId)}
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

      {/* Instrument Panel Header */}
      <div className="instrument-panel-header">
        <div>
          <h2>Instrument Panel</h2>
          <p>Live battery telemetry diagnostics</p>
        </div>
        <div className="header-status">
          <span className={`status-badge ${activeLivePoint.status}`}>{statusLabel[activeLivePoint.status]}</span>
        </div>
      </div>

      {/* KPI Row 1: Voltage, Current, Temperature */}
      <div className="metrics-row">
        <MetricCard icon={Zap} label="Voltage" value={`${activeLivePoint.voltage.toFixed(2)} V`} detail="active bus" tone="good" />
        <MetricCard icon={Activity} label="Current" value={`${activeLivePoint.current.toFixed(2)} A`} detail="realtime draw" tone="good" />
        <MetricCard icon={Flame} label="Temperature" value={`${activeLivePoint.temperature.toFixed(1)} °C`} detail="thermal state" tone={tone} />
      </div>

      {/* KPI Row 2: SOC, SOH, Power */}
      <div className="metrics-row">
        <MetricCard icon={BatteryFull} label="SOC" value={`${(readings[readings.length - 1]?.soc ?? 100)}%`} detail="charge level" tone="good" />
        <MetricCard icon={Gauge} label="SOH" value={`${(readings[readings.length - 1]?.soh ?? 100.0).toFixed(1)}%`} detail="health status" tone="good" />
        <MetricCard icon={Zap} label="Power" value={`${powerValue.toFixed(1)} W`} detail="power draw" tone="good" />
      </div>

      {/* Chart Row 1: Voltage Trend, Current Load (2 cols) */}
      <div className="chart-row-two-cols">
        <TelemetryChartCard 
          title="Voltage Trend" 
          metricKey="voltage" 
          unit="V" 
          data={readings}
          customAxisLabels={customAxisLabels.voltage}
        />
        <TelemetryChartCard 
          title="Current Load" 
          metricKey="current" 
          unit="A" 
          data={readings}
          customAxisLabels={customAxisLabels.current}
        />
      </div>

      {/* Chart Row 2: Thermal Profile, SOC, SOH (3 cols) */}
      <div className="chart-row-three-cols">
        <TelemetryChartCard 
          title="Thermal Profile" 
          metricKey="temperature" 
          unit="°C" 
          data={readings}
          customAxisLabels={customAxisLabels.temperature}
        />
        <TelemetryChartCard 
          title="State of Charge" 
          metricKey="soc" 
          unit="%" 
          data={readings}
          forceYRange={{ min: 0, max: 100 }}
          customAxisLabels={customAxisLabels.soc}
        />
        <TelemetryChartCard 
          title="State of Health" 
          metricKey="soh" 
          unit="%" 
          data={readings}
          forceYRange={{ min: 0, max: 100 }}
          customAxisLabels={customAxisLabels.soh}
        />
      </div>

      {/* Chart Row 3: Power Consumption only (removed Internal Resistance) */}
      <div className="chart-row-two-cols">
        <TelemetryChartCard 
          title="Power Consumption" 
          metricKey="power" 
          unit="W" 
          data={readings}
          customAxisLabels={customAxisLabels.power}
        />
      </div>

      {/* Comparison Charts (user-selected) */}
      {comparisonConfig && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ margin: "8px 0" }}>Comparison Charts</h3>
          {comparisonConfig.mode === "three-variable" ? (
            <div className="chart-row-three-cols">
              <TelemetryChartCard title={comparisonConfig.var1} metricKey={comparisonConfig.var1} unit="" data={readings} />
              <TelemetryChartCard title={comparisonConfig.var2} metricKey={comparisonConfig.var2} unit="" data={readings} />
              <TelemetryChartCard title={comparisonConfig.var3} metricKey={comparisonConfig.var3} unit="" data={readings} />
            </div>
          ) : (
            <div className="chart-row-two-cols">
              <TelemetryChartCard title={comparisonConfig.var1} metricKey={comparisonConfig.var1} unit="" data={readings} />
              <TelemetryChartCard title={comparisonConfig.var2} metricKey={comparisonConfig.var2} unit="" data={readings} />
            </div>
          )}
        </div>
      )}

      {/* Configuration Modal */}
      <ConfigurationModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onApply={handleConfigurationApply}
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

      <ChargeDischargeModal
        isOpen={chargeModalOpen}
        onClose={() => setChargeModalOpen(false)}
        onSelect={(mode) => {
          setChargeModalOpen(false);
          if (mode === "discharge") {
            setConfigModalOpen(true);
          } else if (mode === "charge") {
            // Charge mode currently not supported — no action
          }
        }}
      />

      <VariableComparisonSelector
        isOpen={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        onApply={(cfg) => {
          setComparisonConfig(cfg);
          setComparisonOpen(false);
        }}
        currentSelections={comparisonConfig || {}}
      />
    </>
  );
}

export default Dashboard;
