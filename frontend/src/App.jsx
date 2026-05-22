import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import { endSession, getHistorical, getProfiles, getSessions, sendPiCommand, startSession } from "./backendClient";
import { appUser } from "./data/appConfig";
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
import Landing from "./pages/Landing";
import HistoryAnalytics from "./pages/historyAnalytics";
import { clamp } from "./lib/battery";

function backendPacketToReading(packet, startedAt) {
  const timestampMs = new Date(packet.timestamp).getTime();
  const startedMs = new Date(startedAt ?? packet.timestamp).getTime();
  return {
    time: Number.isFinite(timestampMs) && Number.isFinite(startedMs) ? Math.max(0, (timestampMs - startedMs) / 1000) : 0,
    voltage: Number(packet.pack_voltage ?? 0),
    current: Number(packet.current ?? 0),
    temperature: Number(packet.temperature?.battery ?? 0),
    action: packet.event ?? ""
  };
}

function makeStaticInitialData() {
  const initialBatteryId = localDemoData.batteries[0]?.batteryId ?? "B0047";
  return {
    ...localDemoData,
    liveReadings: {
      [initialBatteryId]: {
        batteryId: initialBatteryId,
        mode: "IDLE",
        status: "healthy",
        soh: 100,
        stream: [
          {
            time: 0,
            voltage: 0,
            current: 0,
            temperature: 0
          }
        ]
      }
    }
  };
}

function mergeLiveReadings(currentLiveReadings, incomingLiveReadings) {
  if (!incomingLiveReadings || Object.keys(incomingLiveReadings).length === 0) {
    return currentLiveReadings;
  }

  const merged = { ...(currentLiveReadings ?? {}) };
  for (const [batteryId, incoming] of Object.entries(incomingLiveReadings)) {
    const current = merged[batteryId];
    const incomingPoint = incoming.stream?.at(-1);
    const currentStream = current?.stream ?? [];
    const lastPoint = currentStream.at(-1);
    const isDuplicate = incomingPoint && lastPoint && (
      incomingPoint.timestamp === lastPoint.timestamp ||
      (
        incomingPoint.time === lastPoint.time &&
        incomingPoint.voltage === lastPoint.voltage &&
        incomingPoint.current === lastPoint.current &&
        incomingPoint.temperature === lastPoint.temperature
      )
    );

    merged[batteryId] = {
      ...current,
      ...incoming,
      stream: incomingPoint && !isDuplicate
        ? [...currentStream, incomingPoint].slice(-300)
        : currentStream.length > 0 ? currentStream : incoming.stream ?? []
    };
  }
  return merged;
}

function App() {
  const initialBattery = localDemoData.batteries[0]?.batteryId ?? "B0047";
  const [data, setData] = useState(makeStaticInitialData);
  const [authView, setAuthView] = useState("landing");
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedBattery, setSelectedBattery] = useState(initialBattery);
  const [dashboardBattery, setDashboardBattery] = useState(initialBattery);
  const [currentUser, setCurrentUser] = useState(appUser);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [historicalLoaded, setHistoricalLoaded] = useState({});
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [theme]);

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
        if (cancelled || !payload) return;
        setData((current) => ({
          ...current,
          ...payload,
          liveReadings: Object.keys(payload.liveReadings ?? {}).length > 0
            ? mergeLiveReadings(current.liveReadings, payload.liveReadings)
            : current.liveReadings
        }));
        setFirebaseReady(true);
        const initialBatteryId = payload.batteries[0]?.batteryId ?? initialBattery;
        setSelectedBattery(initialBatteryId);
        setDashboardBattery(initialBatteryId);
      } catch (error) {
        console.warn("Firebase load failed, using bundled demo data.", error);
        setFirebaseReady(firebaseEnabled);
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
    let cancelled = false;

    async function loadBackendCatalog() {
      try {
        const [profilesPayload, sessionsPayload] = await Promise.all([
          getProfiles(),
          getSessions()
        ]);

        if (cancelled) return;
        setProfiles(profilesPayload.profiles ?? []);

        const backendSessions = (sessionsPayload.sessions ?? []).map((session) => ({
          sessionId: session.session_id,
          batteryId: session.battery_id,
          type: session.config?.discharge_profile ?? "discharge",
          startTime: session.started_at,
          status: session.status,
          sourceFile: "backend",
          readings: []
        }));

        if (backendSessions.length > 0) {
          setData((current) => ({
            ...current,
            testSessions: backendSessions
          }));
        }
      } catch (error) {
        console.warn("Backend catalog load failed; using available Firebase/demo data.", error);
      }
    }

    loadBackendCatalog();

    return () => {
      cancelled = true;
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
    if (!firebaseEnabled || !firebaseReady) return undefined;
    return subscribeLiveReadings((liveReadings) => {
      setData((current) => {
        if (!current) return current;
        const nextLiveReadings = mergeLiveReadings(current.liveReadings, liveReadings);
        const firstIncomingBattery = Object.keys(liveReadings ?? {})[0];
        if (firstIncomingBattery) {
          setDashboardBattery(firstIncomingBattery);
        }
        return { ...current, liveReadings: nextLiveReadings };
      });
    });
  }, [firebaseReady]);

  useEffect(() => {
    if (activePage !== "traceability" || !data?.testSessions?.length) return undefined;

    const session = data.testSessions.find((item) => item.batteryId === selectedBattery) ?? data.testSessions[0];
    if (!session?.sessionId || session.readings?.length > 0 || historicalLoaded[session.sessionId]) return undefined;

    let cancelled = false;
    getHistorical(session.sessionId)
      .then((payload) => {
        if (cancelled) return;
        const readings = (payload.packets ?? [])
          .map((packet) => backendPacketToReading(packet, session.startTime))
          .sort((a, b) => a.time - b.time);

        setData((current) => ({
          ...current,
          testSessions: (current?.testSessions ?? []).map((item) => (
            item.sessionId === session.sessionId ? { ...item, readings } : item
          ))
        }));
        setHistoricalLoaded((current) => ({ ...current, [session.sessionId]: true }));
      })
      .catch((error) => {
        console.warn("Historical telemetry load failed.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [activePage, data?.testSessions, historicalLoaded, selectedBattery]);

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

  async function handleStartSession(payload) {
    const response = await startSession(payload);
    const nextSession = {
      sessionId: response.session_id,
      batteryId: payload.battery_id,
      type: payload.config.discharge_profile,
      startTime: new Date().toISOString(),
      status: response.status,
      sourceFile: response.command?.command?.source_file ?? "backend",
      readings: []
    };

    setData((current) => ({
      ...current,
      testSessions: [nextSession, ...(current?.testSessions ?? [])]
    }));

    setSelectedBattery(payload.battery_id);
    setDashboardBattery(payload.battery_id);
    return response;
  }

  async function handleEndSession(sessionId) {
    const response = await endSession(sessionId);
    setData((current) => ({
      ...current,
      testSessions: (current?.testSessions ?? []).map((session) => (
        session.sessionId === sessionId
          ? { ...session, status: response.status, endedAt: new Date().toISOString() }
          : session
      ))
    }));
    return response;
  }

  function handlePauseSession(sessionId, paused) {
    return sendPiCommand({
      type: paused ? "PAUSE_PROFILE" : "RESUME_PROFILE",
      sessionId,
      command: { paused }
    });
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
  const point = live.stream.at(-1) ?? live.stream[0];
  const livePoint = {
    ...live,
    ...point,
    soc: Math.round(clamp(((point.voltage - 3) / 1.25) * 100, 0, 100)),
    status: point.temperature >= 45 ? "critical" : point.temperature >= 38 ? "warning" : live.status
  };

  return (
    <div className="app-shell">
      <Header 
        activePage={activePage} 
        onPageChange={setActivePage} 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
      />
      <main className="app-content">
        {activePage === "dashboard" && (
          <Dashboard
            data={data}
            livePoint={livePoint}
            liveStream={live.stream}
            activeBattery={live.batteryId ?? dashboardBattery}
            selectedSession={dashboardSession}
            profiles={profiles}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onPauseSession={handlePauseSession}
          />
        )}
        {activePage === "traceability" && (
          <HistoryAnalytics data={data} selectedBattery={selectedBattery} onBatteryChange={setSelectedBattery} />
        )}
      </main>
    </div>
  );
}

export default App;
