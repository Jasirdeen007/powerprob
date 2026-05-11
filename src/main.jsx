import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BatteryCharging,
  ClipboardCheck,
  Database,
  Download,
  FileSpreadsheet,
  Flame,
  Gauge,
  History,
  LogIn,
  PlusCircle,
  Search,
  UserRound,
  UploadCloud,
  Zap
} from "lucide-react";
import { firebaseEnabled, loadFirebaseData, subscribeLiveReadings } from "./firebaseClient";
import localDemoData from "./demo-data.json";
import "./styles.css";

const statusLabel = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical"
};

const demoUsers = [
  {
    id: "technician",
    name: "Tech User",
    role: "Technician",
    access: ["dashboard", "entry", "upload", "traceability"]
  },
  {
    id: "engineer",
    name: "Engineer User",
    role: "Engineer",
    access: ["dashboard", "entry", "upload", "traceability", "compliance", "reports"]
  },
  {
    id: "manager",
    name: "Manager User",
    role: "Manager",
    access: ["dashboard", "traceability", "compliance", "reports"]
  }
];

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function evaluateCompliance(session, rules) {
  const voltages = session.readings.map((reading) => reading.voltage);
  const maxTemperature = session.summary.maxTemperature;
  const minVoltage = Math.min(...voltages);
  const maxVoltage = Math.max(...voltages);
  const checks = [
    {
      label: "Temperature",
      value: `${maxTemperature.toFixed(1)} C`,
      passed: maxTemperature < rules.maxTemperature,
      warning: maxTemperature >= rules.warningTemperature
    },
    {
      label: "SOH",
      value: `${session.summary.soh.toFixed(1)}%`,
      passed: session.summary.soh >= rules.minSOH,
      warning: session.summary.soh < rules.warningSOH
    },
    {
      label: "Voltage range",
      value: `${minVoltage.toFixed(2)}V - ${maxVoltage.toFixed(2)}V`,
      passed: minVoltage >= rules.minVoltage && maxVoltage <= rules.maxVoltage,
      warning: false
    }
  ];
  const failed = checks.some((check) => !check.passed);
  const warned = checks.some((check) => check.warning);
  return { result: failed ? "Fail" : warned ? "Review" : "Pass", checks };
}

function LineChart({ data, series, height = 180 }) {
  const width = 720;
  const padding = 28;
  const values = data.map((item) => item[series.key]).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = data
    .map((item, index) => {
      const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((item[series.key] - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.label}>
      <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
      <line x1={padding} x2={padding} y1={padding} y2={height - padding} />
      <polyline points={points} style={{ stroke: series.color }} />
      <text x={padding} y={18}>{max.toFixed(series.precision ?? 1)} {series.unit}</text>
      <text x={padding} y={height - 5}>{min.toFixed(series.precision ?? 1)} {series.unit}</text>
    </svg>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = "neutral" }) {
  return (
    <section className={`metric ${tone}`}>
      <div className="metric-icon"><Icon size={20} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </section>
  );
}

function Sidebar({ activePage, onPageChange, currentUser, onLogin }) {
  const items = [
    ["dashboard", Gauge, "Dashboard"],
    ["entry", PlusCircle, "Battery Entry"],
    ["upload", UploadCloud, "Dataset Seed"],
    ["traceability", History, "Traceability"],
    ["compliance", ClipboardCheck, "Compliance"],
    ["reports", FileSpreadsheet, "Reports"]
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <BatteryCharging size={28} />
        <div>
          <strong>PowerProbe</strong>
          <span>Battery Analytics</span>
        </div>
      </div>
      <div className="login-panel">
        <span><LogIn size={15} /> Demo login</span>
        <div className="user-buttons">
          {demoUsers.map((user) => (
            <button
              key={user.id}
              className={currentUser.id === user.id ? "selected" : ""}
              onClick={() => onLogin(user)}
            >
              <UserRound size={15} />
              {user.role}
            </button>
          ))}
        </div>
      </div>
      <nav>
        {items.map(([key, Icon, label]) => (
          <button
            key={key}
            className={activePage === key ? "active" : ""}
            disabled={!currentUser.access.includes(key)}
            onClick={() => onPageChange(key)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
      <div className="role-card">
        <span>{currentUser.name}</span>
        <strong>{currentUser.role}</strong>
      </div>
    </aside>
  );
}

function Dashboard({ data, livePoint, activeBattery, selectedSession }) {
  const readings = selectedSession?.readings ?? [];
  const tone = livePoint.status === "critical" ? "danger" : livePoint.status === "warning" ? "warn" : "good";
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Live Battery Dashboard</h1>
          <p>NASA-derived sample readings are streamed locally for the smoke run.</p>
        </div>
        <span className={`status ${livePoint.status}`}>{statusLabel[livePoint.status]}</span>
      </div>
      <div className="metrics-grid">
        <MetricCard icon={Zap} label="Voltage" value={`${livePoint.voltage.toFixed(2)} V`} detail={activeBattery} />
        <MetricCard icon={Activity} label="Current" value={`${livePoint.current.toFixed(2)} A`} detail="Realtime stream" />
        <MetricCard icon={Flame} label="Temperature" value={`${livePoint.temperature.toFixed(1)} C`} detail="Thermal monitor" tone={tone} />
        <MetricCard icon={Gauge} label="SOC / SOH" value={`${livePoint.soc}% / ${livePoint.soh.toFixed(1)}%`} detail="Rule-based estimate" tone="good" />
      </div>
      <section className="panel wide">
        <div className="panel-head">
          <h2>{selectedSession.batteryId} session {selectedSession.testId}</h2>
          <span>{readings.length} sampled points</span>
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

function ChartBlock({ title, data, series }) {
  return (
    <div className="chart-block">
      <h3>{title}</h3>
      <LineChart data={data} series={series} />
    </div>
  );
}

function UploadPlan({ data }) {
  return (
    <section className="panel wide">
      <div className="panel-head">
        <h2>Dataset Seed Smoke Run</h2>
        <span><Database size={16} /> Local mode</span>
      </div>
      <div className="steps">
        <div><strong>1</strong><span>Read NASA metadata and cycle CSV files.</span></div>
        <div><strong>2</strong><span>Normalize battery, test session, reading, and compliance fields.</span></div>
        <div><strong>3</strong><span>Generate `public/demo-data.json` for UI smoke testing.</span></div>
        <div><strong>4</strong><span>Use the same normalized shape for Firestore and Realtime Database push later.</span></div>
      </div>
      <div className="seed-summary">
        <MetricCard icon={BatteryCharging} label="Batteries" value={data.batteries.length} detail="From selected NASA cells" />
        <MetricCard icon={History} label="Sessions" value={data.testSessions.length} detail="Charge/discharge only" />
        <MetricCard icon={Activity} label="Live samples" value={Object.values(data.liveReadings)[0].stream.length} detail="Animated on dashboard" />
      </div>
    </section>
  );
}

function BatteryEntry({ data, onAddBattery }) {
  const [form, setForm] = useState({
    batteryId: "",
    chemistry: "Li-ion",
    manufacturer: "Genesis PowerProbe",
    location: "Coimbatore Test Bench",
    nominalCapacity: "2.0",
    status: "healthy"
  });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const id = form.batteryId.trim().toUpperCase();
    if (!id) return;
    onAddBattery({
      batteryId: id,
      chemistry: form.chemistry,
      manufacturer: form.manufacturer,
      location: form.location,
      nominalCapacity: Number(form.nominalCapacity) || 0,
      latestCapacity: Number(form.nominalCapacity) || 0,
      latestSOH: 100,
      totalTests: 0,
      lastTestAt: new Date().toISOString(),
      status: form.status
    });
    setForm((current) => ({ ...current, batteryId: "" }));
  }

  return (
    <section className="panel wide">
      <div className="panel-head">
        <h2>Battery Detail Entry</h2>
        <span>{data.batteries.length} registered batteries</span>
      </div>
      <form className="entry-form" onSubmit={handleSubmit}>
        <label>
          Battery ID
          <input value={form.batteryId} onChange={(event) => updateField("batteryId", event.target.value)} placeholder="B0100" />
        </label>
        <label>
          Chemistry
          <select value={form.chemistry} onChange={(event) => updateField("chemistry", event.target.value)}>
            <option>Li-ion</option>
            <option>LiFePO4</option>
            <option>NMC</option>
            <option>LCO</option>
          </select>
        </label>
        <label>
          Manufacturer
          <input value={form.manufacturer} onChange={(event) => updateField("manufacturer", event.target.value)} />
        </label>
        <label>
          Test Location
          <input value={form.location} onChange={(event) => updateField("location", event.target.value)} />
        </label>
        <label>
          Nominal Capacity Ah
          <input type="number" step="0.1" min="0" value={form.nominalCapacity} onChange={(event) => updateField("nominalCapacity", event.target.value)} />
        </label>
        <label>
          Initial Status
          <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <button type="submit"><PlusCircle size={18} /> Add Battery</button>
      </form>
      <div className="entry-list">
        {data.batteries.slice(0, 8).map((battery) => (
          <article key={battery.batteryId}>
            <strong>{battery.batteryId}</strong>
            <span>{battery.chemistry} - {battery.totalTests} sessions - {battery.latestSOH.toFixed(1)}% SOH</span>
          </article>
        ))}
      </div>
    </section>
  );
}

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

function Compliance({ data, selectedBattery }) {
  const rows = data.testSessions
    .filter((session) => session.batteryId === selectedBattery)
    .map((session) => ({ session, compliance: evaluateCompliance(session, data.complianceRules) }));
  return (
    <section className="panel wide">
      <div className="panel-head">
        <h2>Certification Compliance</h2>
        <span>{selectedBattery}</span>
      </div>
      <div className="table">
        <div className="table-row head">
          <span>Session</span>
          <span>Type</span>
          <span>Result</span>
          <span>Key Checks</span>
        </div>
        {rows.map(({ session, compliance }) => (
          <div className="table-row" key={session.sessionId}>
            <span>{session.testId}</span>
            <span>{session.type}</span>
            <span className={`result ${compliance.result.toLowerCase()}`}>{compliance.result}</span>
            <span>{compliance.checks.map((check) => `${check.label}: ${check.value}`).join(" | ")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Reports({ selectedSession, data }) {
  function downloadReport(type) {
    const compliance = evaluateCompliance(selectedSession, data.complianceRules);
    const rows = [
      ["Battery ID", selectedSession.batteryId],
      ["Session", selectedSession.sessionId],
      ["Type", selectedSession.type],
      ["Start time", selectedSession.startTime],
      ["SOH", `${selectedSession.summary.soh}%`],
      ["Max temperature", `${selectedSession.summary.maxTemperature} C`],
      ["Compliance", compliance.result]
    ];
    const content = type === "json"
      ? JSON.stringify({ session: selectedSession, compliance }, null, 2)
      : rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([content], { type: type === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedSession.sessionId}-report.${type === "json" ? "json" : "csv"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel reports">
      <div className="panel-head">
        <h2>Reports</h2>
        <span>{selectedSession.sessionId}</span>
      </div>
      <p>Smoke-run exports use CSV and JSON. Firebase Storage upload can attach to the same report metadata once credentials are added.</p>
      <div className="report-actions">
        <button onClick={() => downloadReport("csv")}><Download size={18} /> Export CSV</button>
        <button onClick={() => downloadReport("json")}><Download size={18} /> Export JSON</button>
      </div>
    </section>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedBattery, setSelectedBattery] = useState("B0047");
  const [streamIndex, setStreamIndex] = useState(0);
  const [currentUser, setCurrentUser] = useState(demoUsers[1]);

  useEffect(() => {
    async function loadData() {
      let payload = null;
      if (firebaseEnabled) {
        try {
          payload = await loadFirebaseData();
        } catch (error) {
          console.warn("Firebase load failed, falling back to local demo data.", error);
        }
      }
      if (!payload || payload.testSessions.length === 0) payload = localDemoData;
      setData(payload);
      setSelectedBattery(payload.batteries[0]?.batteryId ?? "B0047");
    }
    loadData();
  }, []);

  const live = useMemo(() => {
    if (!data) return null;
    return Object.values(data.liveReadings)[0];
  }, [data]);

  useEffect(() => {
    if (!live) return undefined;
    const timer = window.setInterval(() => {
      setStreamIndex((index) => (index + 1) % live.stream.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [live]);

  useEffect(() => {
    if (!firebaseEnabled) return undefined;
    return subscribeLiveReadings((liveReadings) => {
      if (Object.keys(liveReadings).length === 0) return;
      setData((current) => current ? { ...current, liveReadings } : current);
    });
  }, []);

  if (!data || !live) {
    return <main className="loading">Loading battery smoke demo...</main>;
  }

  const selectedSession = data.testSessions.find((session) => session.batteryId === selectedBattery) ?? data.testSessions[0];
  const point = live.stream[streamIndex];
  const livePoint = {
    ...live,
    ...point,
    soc: Math.round(clamp(((point.voltage - 3) / 1.25) * 100, 0, 100)),
    status: point.temperature >= 45 ? "critical" : point.temperature >= 38 ? "warning" : live.status
  };

  function handleLogin(user) {
    setCurrentUser(user);
    if (!user.access.includes(activePage)) {
      setActivePage(user.access[0]);
    }
  }

  function handleAddBattery(battery) {
    setData((current) => {
      const exists = current.batteries.some((item) => item.batteryId === battery.batteryId);
      const batteries = exists
        ? current.batteries.map((item) => item.batteryId === battery.batteryId ? { ...item, ...battery } : item)
        : [battery, ...current.batteries];
      return { ...current, batteries };
    });
    setSelectedBattery(battery.batteryId);
    setActivePage("traceability");
  }

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onPageChange={setActivePage} currentUser={currentUser} onLogin={handleLogin} />
      <main className="content">
        {activePage === "dashboard" && (
          <Dashboard data={data} livePoint={livePoint} activeBattery={live.batteryId} selectedSession={selectedSession} />
        )}
        {activePage === "entry" && <BatteryEntry data={data} onAddBattery={handleAddBattery} />}
        {activePage === "upload" && <UploadPlan data={data} />}
        {activePage === "traceability" && (
          <Traceability data={data} selectedBattery={selectedBattery} onBatteryChange={setSelectedBattery} />
        )}
        {activePage === "compliance" && <Compliance data={data} selectedBattery={selectedBattery} />}
        {activePage === "reports" && <Reports selectedSession={selectedSession} data={data} />}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
