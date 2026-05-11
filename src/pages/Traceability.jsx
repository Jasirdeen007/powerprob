import { Search } from "lucide-react";
import { formatDate } from "../lib/battery";

function Traceability({ data, selectedBattery, onBatteryChange }) {
  const sessions = data.testSessions.filter((session) => session.batteryId === selectedBattery);

  return (
    <section className="panel wide">
      <div className="panel-head">
        <h2>Battery Traceability</h2>
        <label className="search-box">
          <Search size={17} />
          <select value={selectedBattery} onChange={(event) => onBatteryChange(event.target.value)}>
            {data.batteries.map((battery) => <option key={battery.batteryId}>{battery.batteryId}</option>)}
          </select>
        </label>
      </div>
      <div className="timeline">
        {sessions.map((session) => (
          <article key={session.sessionId} className="timeline-item">
            <span className={`dot ${session.status}`} />
            <div>
              <strong>{session.type.toUpperCase()} test {session.testId}</strong>
              <p>{formatDate(session.startTime)} - Source {session.sourceFile}</p>
            </div>
            <div className="timeline-metrics">
              <span>{session.summary.soh.toFixed(1)}% SOH</span>
              <span>{session.summary.maxTemperature.toFixed(1)} C</span>
              <span>{session.summary.avgVoltage.toFixed(2)} V avg</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Traceability;
