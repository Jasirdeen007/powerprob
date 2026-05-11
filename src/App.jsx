import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import { appUser, droneProfiles } from "./data/appConfig";
import { firebaseEnabled, loadFirebaseData, subscribeLiveReadings } from "./firebaseClient";
import localDemoData from "./demo-data.json";
import Dashboard from "./pages/Dashboard";
import BatteryEntry from "./pages/BatteryEntry";
import Profiles from "./pages/Profiles";
import Traceability from "./pages/Traceability";
import Reports from "./pages/Reports";
import { clamp, createDroneProfileSession } from "./lib/battery";

function App() {
  const [data, setData] = useState(null);
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedBattery, setSelectedBattery] = useState("B0047");
  const [dashboardBattery, setDashboardBattery] = useState("B0047");
  const [selectedProfileId, setSelectedProfileId] = useState(droneProfiles[0].id);
  const [streamIndex, setStreamIndex] = useState(0);
  const currentUser = appUser;

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
      const initialBattery = payload.batteries[0]?.batteryId ?? "B0047";
      setSelectedBattery(initialBattery);
      setDashboardBattery(initialBattery);
    }
    loadData();
  }, []);

  const defaultLiveBattery = useMemo(() => {
    if (!data) return "B0047";
    const loopingEntry = Object.entries(data.liveReadings).find(([, reading]) => reading.mode !== "drone-profile");
    return loopingEntry?.[0] ?? data.batteries[0]?.batteryId ?? "B0047";
  }, [data]);

  const live = useMemo(() => {
    if (!data) return null;
    return data.liveReadings[dashboardBattery] ?? data.liveReadings[defaultLiveBattery] ?? Object.values(data.liveReadings)[0];
  }, [data, dashboardBattery, defaultLiveBattery]);

  useEffect(() => {
    if (!live) return undefined;
    const timer = window.setInterval(() => {
      setStreamIndex((index) => {
        const nextIndex = index + 1;
        const isProfileStream = live.mode === "drone-profile";
        if (isProfileStream && nextIndex >= live.stream.length) {
          setDashboardBattery(defaultLiveBattery);
          return 0;
        }
        return nextIndex % live.stream.length;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [defaultLiveBattery, live]);

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
  const dashboardSession = data.testSessions.find((session) => session.batteryId === (live.batteryId ?? dashboardBattery)) ?? selectedSession;
  const point = live.stream[streamIndex % live.stream.length] ?? live.stream[0];
  const livePoint = {
    ...live,
    ...point,
    soc: Math.round(clamp(((point.voltage - 3) / 1.25) * 100, 0, 100)),
    status: point.temperature >= 45 ? "critical" : point.temperature >= 38 ? "warning" : live.status
  };

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

  function handleStartProfileTest(profile, battery) {
    if (!battery) return;
    setData((current) => {
      const latestBattery = current.batteries.find((item) => item.batteryId === battery.batteryId) ?? battery;
      const sequence = current.testSessions.filter((session) => session.batteryId === latestBattery.batteryId).length;
      const synthetic = createDroneProfileSession(profile, latestBattery, sequence);
      const batteries = current.batteries.some((item) => item.batteryId === latestBattery.batteryId)
        ? current.batteries.map((item) => item.batteryId === latestBattery.batteryId ? synthetic.battery : item)
        : [synthetic.battery, ...current.batteries];
      return {
        ...current,
        source: `${current.source} + local drone profiles`,
        batteries,
        testSessions: [synthetic.session, ...current.testSessions],
        liveReadings: {
          ...current.liveReadings,
          [latestBattery.batteryId]: synthetic.liveReading
        }
      };
    });
    setSelectedBattery(battery.batteryId);
    setDashboardBattery(battery.batteryId);
    setStreamIndex(0);
    setActivePage("dashboard");
  }

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onPageChange={setActivePage} currentUser={currentUser} />
      <main className="content">
        {activePage === "dashboard" && (
          <Dashboard
            data={data}
            livePoint={livePoint}
            liveStream={live.stream}
            streamIndex={streamIndex}
            activeBattery={live.batteryId ?? dashboardBattery}
            selectedSession={dashboardSession}
          />
        )}
        {activePage === "profiles" && (
          <Profiles
            profiles={droneProfiles}
            selectedProfileId={selectedProfileId}
            onSelectProfile={setSelectedProfileId}
            selectedBattery={selectedBattery}
            batteries={data.batteries}
            onBatteryChange={setSelectedBattery}
            onStartTest={handleStartProfileTest}
          />
        )}
        {activePage === "entry" && <BatteryEntry data={data} onAddBattery={handleAddBattery} />}
        {activePage === "traceability" && (
          <Traceability data={data} selectedBattery={selectedBattery} onBatteryChange={setSelectedBattery} />
        )}
        {activePage === "reports" && <Reports selectedSession={selectedSession} />}
      </main>
    </div>
  );
}

export default App;
