import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import { appUser, droneProfiles } from "./data/appConfig";
import {
  authEnabled,
  createFirebaseAccount,
  firebaseEnabled,
  loadFirebaseData,
  signInFirebaseAccount,
  signOutFirebaseAccount,
  subscribeAuthState,
  subscribeLiveReadings
} from "./firebaseClient";
import localDemoData from "./demo-data.json";
import Dashboard from "./pages/Dashboard";
import BatteryEntry from "./pages/BatteryEntry";
import Landing from "./pages/Landing";
import Profiles from "./pages/Profiles";
import Traceability from "./pages/Traceability";
import Reports from "./pages/Reports";
import { clamp, createDroneProfileSession } from "./lib/battery";

function App() {
  const initialBattery = localDemoData.batteries[0]?.batteryId ?? "B0047";
  const [data, setData] = useState(localDemoData);
  const [authView, setAuthView] = useState("landing");
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedBattery, setSelectedBattery] = useState(initialBattery);
  const [dashboardBattery, setDashboardBattery] = useState(initialBattery);
  const [selectedProfileId, setSelectedProfileId] = useState(droneProfiles[0].id);
  const [streamIndex, setStreamIndex] = useState(0);
  const [currentUser, setCurrentUser] = useState(appUser);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    let timeoutId;
    let cancelled = false;

    async function loadData() {
      if (!firebaseEnabled) return;

      try {
        const timeout = new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error("Firebase data load timed out.")), 2500);
        });
        const payload = await Promise.race([loadFirebaseData(), timeout]);
        if (cancelled || !payload || payload.testSessions.length === 0) return;
        setData(payload);
        setFirebaseReady(true);
        const initialBatteryId = payload.batteries[0]?.batteryId ?? initialBattery;
        setSelectedBattery(initialBatteryId);
        setDashboardBattery(initialBatteryId);
      } catch (error) {
        console.warn("Firebase load failed, using bundled demo data.", error);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    }

    loadData();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!authEnabled) return undefined;
    return subscribeAuthState((user) => {
      if (!user) return;
      setCurrentUser({
        ...appUser,
        name: user.displayName || user.email?.split("@")[0] || appUser.name,
        role: appUser.role
      });
      setAuthView("app");
      setActivePage("dashboard");
    });
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
    if (!firebaseReady) return undefined;
    return subscribeLiveReadings((liveReadings) => {
      if (Object.keys(liveReadings).length === 0) return;
      setData((current) => current ? { ...current, liveReadings } : current);
    });
  }, [firebaseReady]);

  async function handleAuthSubmit(userDetails) {
    setAuthError("");
    setAuthPending(true);

    try {
      const fallbackName = userDetails.email ? userDetails.email.split("@")[0] : appUser.name;

      if (authEnabled) {
        if (userDetails.mode === "signup") {
          const user = await createFirebaseAccount(userDetails);
          setCurrentUser({
            ...appUser,
            name: user.displayName || userDetails.name || fallbackName,
            role: appUser.role
          });
        } else {
          const user = await signInFirebaseAccount(userDetails);
          setCurrentUser({
            ...appUser,
            name: user.displayName || fallbackName,
            role: appUser.role
          });
        }
      } else {
        setCurrentUser({
          ...appUser,
          name: userDetails.name || fallbackName,
          role: appUser.role
        });
      }

      setAuthView("app");
      setActivePage("dashboard");
    } catch (error) {
      console.error(error);
      setAuthError(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setAuthPending(false);
    }
  }

  async function handleLogout() {
    if (authEnabled) {
      await signOutFirebaseAccount();
    }
    setAuthView("landing");
    setCurrentUser(appUser);
    setActivePage("dashboard");
  }

  if (authView !== "app") {
    return (
      <Landing
        mode={authView}
        onEnterApp={() => setAuthView("login")}
        onShowLogin={() => setAuthView("login")}
        onShowSignup={() => setAuthView("signup")}
        onBackHome={() => setAuthView("landing")}
        onAuthSubmit={handleAuthSubmit}
        authPending={authPending}
        authError={authError}
      />
    );
  }

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
      <Sidebar activePage={activePage} onPageChange={setActivePage} currentUser={currentUser} onLogout={handleLogout} />
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
