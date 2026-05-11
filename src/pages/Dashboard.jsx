import { Activity, Flame, Gauge, Zap } from "lucide-react";
import ChartBlock from "../components/ChartBlock";
import MetricCard from "../components/MetricCard";
import { statusLabel } from "../data/appConfig";
import { clamp } from "../lib/battery";

function Dashboard({ data, livePoint, liveStream, streamIndex, activeBattery, selectedSession }) {
  const fullReadings = liveStream.length > 0 ? liveStream : selectedSession?.readings ?? [];
  const currentIndex = fullReadings.length > 0 ? streamIndex % fullReadings.length : 0;
  const readings = fullReadings.slice(0, currentIndex + 1);
  const tone = livePoint.status === "critical" ? "danger" : livePoint.status === "warning" ? "warn" : "good";

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Live Battery Dashboard</h1>
          <p>Telemetry is streamed into KPIs and charts for the active test battery.</p>
        </div>
        <span className={`status ${livePoint.status}`}>{statusLabel[livePoint.status]}</span>
      </div>
      <section className="running-strip">
        <div>
          <span>Running Battery</span>
          <strong>{activeBattery}</strong>
        </div>
        <div>
          <span>Session</span>
          <strong>{selectedSession?.sessionId ?? "Live stream"}</strong>
        </div>
        <div>
          <span>Sample</span>
          <strong>{currentIndex + 1} / {fullReadings.length}</strong>
        </div>
      </section>
      <div className="metrics-grid">
        <MetricCard icon={Zap} label="Voltage" value={`${livePoint.voltage.toFixed(2)} V`} detail={activeBattery} />
        <MetricCard icon={Activity} label="Current" value={`${livePoint.current.toFixed(2)} A`} detail="Realtime stream" />
        <MetricCard icon={Flame} label="Temperature" value={`${livePoint.temperature.toFixed(1)} C`} detail="Thermal monitor" tone={tone} />
        <MetricCard icon={Gauge} label="SOC / SOH" value={`${livePoint.soc}% / ${livePoint.soh.toFixed(1)}%`} detail="Rule-based estimate" tone="good" />
      </div>
      <section className="panel wide">
        <div className="panel-head">
          <h2>{selectedSession.batteryId} session {selectedSession.testId}</h2>
          <span>{readings.length} / {fullReadings.length} live samples</span>
        </div>
        <div className="chart-grid">
          <ChartBlock title="Voltage" data={readings} series={{ key: "voltage", label: "Voltage", color: "#246bfe", unit: "V", precision: 2 }} />
          <ChartBlock title="Current" data={readings} series={{ key: "current", label: "Current", color: "#15915b", unit: "A", precision: 2 }} />
          <ChartBlock title="Temperature" data={readings} series={{ key: "temperature", label: "Temperature", color: "#d94b2b", unit: "C", precision: 1 }} />
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-head">
          <h2>Fleet Snapshot</h2>
          <span>{data.batteries.length} batteries</span>
        </div>
        <div className="fleet-grid">
          {data.batteries.map((battery) => (
            <article key={battery.batteryId} className="fleet-item">
              <div>
                <strong>{battery.batteryId}</strong>
                <span>{battery.totalTests} sessions</span>
              </div>
              <div className="soh-bar"><span style={{ width: `${clamp(battery.latestSOH, 0, 100)}%` }} /></div>
              <span className={`status ${battery.status}`}>{battery.latestSOH.toFixed(1)}% SOH</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export default Dashboard;
