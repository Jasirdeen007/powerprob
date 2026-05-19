import { useState, useEffect } from "react";
import { Activity, AlertTriangle, AreaChart, BarChart3, BatteryFull, Flame, Gauge, LineChart, Search, ScatterChart, Zap, Filter, Play, Pause, Square } from "lucide-react";
import MetricCard from "../components/MetricCard";
import TelemetryChartCard from "../components/TelemetryChartCard";
import { statusLabel } from "../data/appConfig";
import { clamp } from "../lib/battery";

function Dashboard({ livePoint, liveStream, streamIndex, selectedSession }) {
  const [hideControls, setHideControls] = useState(false);
  const [cRating, setCRating] = useState("25");
  const [batteryType, setBatteryType] = useState("Li-ion");
  const [mah, setMah] = useState("2200");
  const [numCells, setNumCells] = useState("3");
  const [voltage, setVoltage] = useState("11.1");
  const [droneProfile, setDroneProfile] = useState("Surveillance Drone");

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [localStreamIndex, setLocalStreamIndex] = useState(0);

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

  useEffect(() => {
    if (!isRunning || isPaused || fullReadings.length === 0) return;
    const interval = setInterval(() => {
      setLocalStreamIndex((prev) => {
        const next = prev + 1;
        return next % fullReadings.length;
      });
    }, 900);
    return () => clearInterval(interval);
  }, [isRunning, isPaused, fullReadings.length]);

  const activeIndex = isRunning ? localStreamIndex : streamIndex;
  const point = fullReadings[activeIndex % fullReadings.length] ?? fullReadings[0] ?? livePoint;

  const activeLivePoint = {
    ...livePoint,
    ...point,
    soc: Math.round(clamp(((point.voltage - 3) / 1.25) * 100, 0, 100)),
    status: point.temperature >= 45 ? "critical" : point.temperature >= 38 ? "warning" : livePoint.status
  };

  const readings = fullReadings.slice(0, activeIndex + 1).map((reading, index, list) => {
    const previous = list[index - 1];
    const deltaVoltage = previous ? Math.abs(reading.voltage - previous.voltage) : 0;
    const deltaCurrent = previous ? Math.abs(reading.current - previous.current) : 0;
    const computedSoc = Math.round(clamp(100 - (index / Math.max(1, list.length)) * 75, 0, 100));
    const computedSoh = Number((99.5 - (index / Math.max(1, list.length)) * 4.2).toFixed(2));
    return {
      ...reading,
      soc: computedSoc,
      soh: computedSoh,
      power: Number((reading.voltage * reading.current).toFixed(2)),
      internalResistance: Number((deltaCurrent > 0 ? deltaVoltage / deltaCurrent : 0).toFixed(3)),
      thermalLimit: 38,
      criticalLimit: 45
    };
  });

  const alertEvents = readings
    .filter((reading) => reading.temperature >= 38 || reading.voltage < 3.25)
    .slice(-4);

  const powerValue = activeLivePoint.voltage * activeLivePoint.current;
  const tone = activeLivePoint.status === "critical" ? "danger" : activeLivePoint.status === "warning" ? "warn" : "good";
  const loadPercent = Math.round(clamp(activeLivePoint.soh, 0, 100));

  const profileDescriptions = {
    "Surveillance Drone": "Surveillance Drone: Hover, camera sweep, return, and controlled landing",
    "Delivery Heavy Lift": "Delivery Heavy Lift: Payload attachment, high-draw transit, drop-off, return",
    "FPV Racing Drone": "FPV Racing Drone: High-speed gates, maximum output draw, loops, thermal challenge",
    "Inspection Quad": "Inspection Quad: Structural check, steady grid path, high-wind holds, precision landing"
  };

  const handleRun = () => {
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    setLocalStreamIndex(0);
  };
  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1>Live Battery Dashboard</h1>
          <p>Configure battery simulation specs and monitor live diagnostics telemetry.</p>
        </div>
        <button
          onClick={() => setHideControls(!hideControls)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', borderRadius: '8px',
            background: hideControls ? '#246bfe' : '#1f2937', color: '#ffffff',
            border: 'none', cursor: 'pointer', fontWeight: '700', transition: 'background-color 0.15s ease'
          }}
        >
          <Filter size={16} />
          Filter
        </button>
      </div>

      {!hideControls && (
        <div className="panel dashboard-controls" style={{ padding: '20px 0', borderRadius: '12px', background: 'var(--panel-bg)', border: '1px solid var(--border)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)' }}>Dashboard Controls</h2>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Battery specs feed the drone profile layer</span>
          </div>

          {/* Layer 1: Battery Specs */}
          <div style={{ marginBottom: '24px', paddingLeft: '24px', paddingRight: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-main)' }}>
              <span>Layer 1: Battery Specs</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-light)' }}>Only these values affect the profile setup.</span>
            </h3>
            <div className="spec-inputs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              {/* C Rating */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', borderRadius: '8px', background: '#ffffff', border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '700' }}>C Rating</label>
                <input
                  type="number"
                  value={cRating}
                  onChange={(e) => setCRating(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #dce3ec', background: '#ffffff', color: '#1f2937', fontSize: '0.9rem', outline: 'none', fontWeight: '600' }}
                />
              </div>
              {/* Battery Type */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', borderRadius: '8px', background: '#ffffff', border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '700' }}>Battery Type</label>
                <select
                  value={batteryType}
                  onChange={(e) => setBatteryType(e.target.value)}
                  style={{
                    padding: '8px 30px 8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #dce3ec',
                    background: '#ffffff',
                    color: '#1f2937',
                    fontSize: '0.9rem',
                    outline: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='%2364748b' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 8px center',
                    backgroundSize: '16px'
                  }}
                >
                  <option value="Li-ion">Li-ion</option>
                  <option value="LiPo">LiPo</option>
                  <option value="LifePO4">LifePO4</option>
                  <option value="Solid-State">Solid-State</option>
                </select>
              </div>
              {/* mAh */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', borderRadius: '8px', background: '#ffffff', border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '700' }}>mAh</label>
                <input
                  type="number"
                  value={mah}
                  onChange={(e) => setMah(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #dce3ec', background: '#ffffff', color: '#1f2937', fontSize: '0.9rem', outline: 'none', fontWeight: '600' }}
                />
              </div>
              {/* No. of Cells */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', borderRadius: '8px', background: '#ffffff', border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '700' }}>No. of Cells</label>
                <input
                  type="number"
                  value={numCells}
                  onChange={(e) => setNumCells(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #dce3ec', background: '#ffffff', color: '#1f2937', fontSize: '0.9rem', outline: 'none', fontWeight: '600' }}
                />
              </div>
              {/* Voltage */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', borderRadius: '8px', background: '#ffffff', border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '700' }}>Voltage</label>
                <input
                  type="number"
                  step="0.1"
                  value={voltage}
                  onChange={(e) => setVoltage(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #dce3ec', background: '#ffffff', color: '#1f2937', fontSize: '0.9rem', outline: 'none', fontWeight: '600' }}
                />
              </div>
            </div>
          </div>

          {/* Layer 2: Drone Profile */}
          <div style={{ paddingLeft: '24px', paddingRight: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-main)' }}>
              <span>Layer 2: Drone Profile</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-light)' }}>
                {profileDescriptions[droneProfile]}
              </span>
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', flex: 1, minWidth: '320px' }}>
                {/* Drone Profile Selection Dropdown */}
                <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '600' }}>Drone Profile</label>
                  <select
                    value={droneProfile}
                    onChange={(e) => setDroneProfile(e.target.value)}
                    style={{
                      padding: '10px 36px 10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: '#ffffff',
                      color: '#1f2937',
                      fontSize: '0.9rem',
                      outline: 'none',
                      fontWeight: '600',
                      cursor: 'pointer',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='%2364748b' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 10px center',
                      backgroundSize: '18px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <option value="Surveillance Drone">⚡ Surveillance Drone</option>
                    <option value="Delivery Heavy Lift">⚡ Delivery Heavy Lift</option>
                    <option value="FPV Racing Drone">⚡ FPV Racing Drone</option>
                    <option value="Inspection Quad">⚡ Inspection Quad</option>
                  </select>
                </div>

                {/* Specs Tag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '8px', background: 'var(--bg-light)', border: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', height: '42px', marginTop: '24px' }}>
                  <Zap size={14} style={{ color: '#246bfe' }} />
                  <span>{cRating}C / {batteryType} / {mah} mAh / {numCells}S / {voltage} V</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '24px' }}>
                <button
                  onClick={handleRun}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 20px', borderRadius: '8px',
                    background: isRunning && !isPaused ? '#246bfe' : '#111827',
                    color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: '700', transition: 'background-color 0.15s ease'
                  }}
                >
                  <Play size={14} fill="#ffffff" />
                  Run
                </button>
                <button
                  onClick={handlePause}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 20px', borderRadius: '8px',
                    background: isPaused ? '#246bfe' : '#ffffff',
                    color: isPaused ? '#ffffff' : '#111827', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: '700', transition: 'background-color 0.15s ease'
                  }}
                >
                  <Pause size={14} fill={isPaused ? "#ffffff" : "none"} />
                  Pause
                </button>
                <button
                  onClick={handleStop}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 20px', borderRadius: '8px',
                    background: '#ffffff', color: '#b72f1f', border: '1px solid #ffe5e0', cursor: 'pointer', fontWeight: '700', transition: 'background-color 0.15s ease'
                  }}
                >
                  <Square size={14} fill="#b72f1f" />
                  Stop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="instrument-head" style={{ marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)' }}>Instrument Panel</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-light)' }}>Live battery service - telemetry diagnostics</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <label className="instrument-search" style={{ margin: 0 }}>
            <Search size={17} />
            <input placeholder="Search telemetry..." readOnly style={{ border: 'none', background: 'transparent', outline: 'none' }} />
          </label>
          <span className={`status ${activeLivePoint.status}`}>{statusLabel[activeLivePoint.status]}</span>
        </div>
      </div>

      {/* KPI Row 1: Voltage, Current, Temperature */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px', marginBottom: '14px' }}>
        <MetricCard icon={Zap} label="Voltage" value={`${activeLivePoint.voltage.toFixed(2)}`} detail="V active bus" indicator="live" />
        <MetricCard icon={Activity} label="Current" value={`${activeLivePoint.current.toFixed(2)}`} detail="A realtime draw" indicator="live" />
        <MetricCard icon={Flame} label="Temperature" value={`${activeLivePoint.temperature.toFixed(1)}`} detail="C thermal state" tone={tone} indicator={tone} />
      </div>
      {/* KPI Row 2: SOC, SOH, Power */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <MetricCard icon={BatteryFull} label="SOC" value={`${(readings[readings.length - 1]?.soc ?? 100)}%`} detail="charge gauge" tone="good" gaugeValue={(readings[readings.length - 1]?.soc ?? 100)} />
        <MetricCard icon={Gauge} label="SOH" value={`${(readings[readings.length - 1]?.soh ?? 100.0).toFixed(1)}%`} detail="health gauge" tone="good" gaugeValue={(readings[readings.length - 1]?.soh ?? 100.0)} />
        <MetricCard icon={Zap} label="Power" value={`${powerValue.toFixed(1)}`} detail="W consumed" indicator="live" />
      </div>

      {/* Chart Row 1: Voltage Trend, Current Load (2 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px', marginBottom: '14px' }}>
        <TelemetryChartCard title="Voltage Trend" metricKey="voltage" unit="V" data={readings} />
        <TelemetryChartCard title="Current Load" metricKey="current" unit="A" data={readings} />
      </div>
      {/* Chart Row 2: Thermal Profile, SOC, SOH (3 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px', marginBottom: '14px' }}>
        <TelemetryChartCard title="Thermal Profile" metricKey="temperature" unit="C" data={readings} />
        <TelemetryChartCard title="State of Charge" metricKey="soc" unit="%" data={readings} />
        <TelemetryChartCard title="State of Health" metricKey="soh" unit="%" data={readings} />
      </div>
      {/* Chart Row 3: Power Consumption, Internal Resistance (2 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px', marginBottom: '14px' }}>
        <TelemetryChartCard title="Power Consumption" metricKey="power" unit="W" data={readings} />
        <TelemetryChartCard title="Internal Resistance" metricKey="internalResistance" unit="Ω" data={readings} />
      </div>

    </>
  );
}

export default Dashboard;
