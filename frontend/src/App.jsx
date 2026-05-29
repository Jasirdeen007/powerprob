import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import { endSession, getHistorical, getLiveTelemetry, getPiStatus, getProfiles, getSessions, sendPiCommand, startSession } from "./backendClient";
import { appUser } from "./data/appConfig";
import {
  authEnabled,
  createFirebaseAccount,
  firebaseEnabled,
  loadFirebaseData,
  signInFirebaseAccount,
  signOutFirebaseAccount,
  subscribeAuthState,
  subscribeLiveReadings,
  backendTelemetryToLiveReadings,
  backendTelemetryToReading
} from "./firebaseClient";
import localDemoData from "./demo-data.json";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import HistoryAnalytics from "./pages/historyAnalytics";
import { clamp } from "./lib/battery";

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

function makeZeroLiveReading(batteryId) {
  return {
    batteryId,
    mode: "IDLE",
    status: "healthy",
    soh: 100,
    stream: [
      {
        time: 0,
        voltage: 0,
        current: 0,
        temperature: 0,
        soc: 0,
        soh: 0,
        power: 0,
        status: "healthy"
      }
    ]
  };
}

function mergeLiveReadings(currentLiveReadings, incomingLiveReadings) {
  if (!incomingLiveReadings || Object.keys(incomingLiveReadings).length === 0) {
    return currentLiveReadings;
  }

  const merged = { ...(currentLiveReadings ?? {}) };
  for (const [batteryId, incoming] of Object.entries(incomingLiveReadings)) {
    const current = merged[batteryId];
    const incomingPoints = Array.isArray(incoming.stream) ? incoming.stream : [];
    const currentStream = current?.stream ?? [];
    const existingKeys = new Set(currentStream.map((point) => (
      point.timestamp ?? `${point.time}-${point.voltage}-${point.current}-${point.temperature}`
    )));
    const newPoints = incomingPoints.filter((point) => {
      const key = point.timestamp ?? `${point.time}-${point.voltage}-${point.current}-${point.temperature}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    merged[batteryId] = {
      ...current,
      ...incoming,
      stream: [...currentStream, ...newPoints]
        .sort((a, b) => {
          const aTime = new Date(a.timestamp ?? 0).getTime();
          const bTime = new Date(b.timestamp ?? 0).getTime();
          if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
          return Number(a.time ?? 0) - Number(b.time ?? 0);
        })
        .slice(-300)
    };
  }
  return merged;
}

function isRealTelemetryPoint(reading) {
  if (!reading) return false;
  if (reading.timestamp) return true;
  return [reading.voltage, reading.current, reading.temperature].some((value) => Number(value) !== 0);
}

function appendLiveReadingsToSessions(currentSessions = [], incomingLiveReadings = {}) {
  const byId = new Map(currentSessions.map((session) => [session.sessionId, session]));

  for (const [batteryId, incoming] of Object.entries(incomingLiveReadings ?? {})) {
    const point = incoming.stream?.at(-1);
    if (!isRealTelemetryPoint(point)) continue;

    const sessionId = incoming.sessionId || point.sessionId || `live-${batteryId}`;
    const current = byId.get(sessionId);
    const currentReadings = current?.readings ?? [];
    const lastPoint = currentReadings.at(-1);
    const isDuplicate = lastPoint && (
      (point.timestamp && point.timestamp === lastPoint.timestamp) ||
      (
        point.time === lastPoint.time &&
        point.voltage === lastPoint.voltage &&
        point.current === lastPoint.current &&
        point.temperature === lastPoint.temperature
      )
    );

    byId.set(sessionId, {
      ...current,
      sessionId,
      batteryId,
      batteryName: current?.batteryName ?? "",
      type: incoming.mode ?? current?.type ?? "DISCHARGE",
      startTime: current?.startTime ?? point.timestamp ?? new Date().toISOString(),
      status: incoming.status ?? current?.status ?? "running",
      sourceFile: current?.sourceFile ?? "pi-live",
      readings: isDuplicate ? currentReadings : [...currentReadings, point]
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    const bTime = new Date(b.startTime ?? 0).getTime();
    const aTime = new Date(a.startTime ?? 0).getTime();
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

function mergeSessions(currentSessions = [], incomingSessions = []) {
  const byId = new Map(currentSessions.map((session) => [session.sessionId, session]));
  for (const incoming of incomingSessions) {
    const current = byId.get(incoming.sessionId);
    byId.set(incoming.sessionId, {
      ...current,
      ...incoming,
      readings: incoming.readings?.length > 0 ? incoming.readings : current?.readings ?? []
    });
  }
  return Array.from(byId.values()).sort((a, b) => {
    const bTime = new Date(b.startTime ?? 0).getTime();
    const aTime = new Date(a.startTime ?? 0).getTime();
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
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
  const [theme, setTheme] = useState("light");
  const [piStatus, setPiStatus] = useState({
    connected: false,
    transport: "websocket",
    endpoint: "/ws/pi"
  });
  const userId = currentUser?.uid || appUser.uid;

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
        const payload = await Promise.race([loadFirebaseData(userId), timeout]);
        if (cancelled || !payload) return;
        setData((current) => ({
          ...current,
          ...payload,
          liveReadings: Object.keys(payload.liveReadings ?? {}).length > 0
            ? mergeLiveReadings(current.liveReadings, payload.liveReadings)
            : current.liveReadings,
          testSessions: Object.keys(payload.liveReadings ?? {}).length > 0
            ? appendLiveReadingsToSessions(payload.testSessions ?? current.testSessions ?? [], payload.liveReadings)
            : payload.testSessions ?? current.testSessions
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
          getSessions(userId)
        ]);

        if (cancelled) return;
        setProfiles(profilesPayload.profiles ?? []);

        const backendSessions = (sessionsPayload.sessions ?? []).map((session) => ({
          sessionId: session.session_id,
          batteryId: session.battery_id,
          batteryName: session.battery_name ?? "",
          type: session.config?.discharge_profile ?? "discharge",
          startTime: session.started_at,
          status: session.status,
          sourceFile: "backend",
          readings: []
        }));

        if (backendSessions.length > 0) {
          setData((current) => ({
            ...current,
            testSessions: mergeSessions(current?.testSessions ?? [], backendSessions)
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
    let cancelled = false;

    async function refreshPiStatus() {
      try {
        const status = await getPiStatus();
        if (!cancelled) {
          setPiStatus(status);
        }
      } catch (error) {
        if (!cancelled) {
          setPiStatus({
            connected: false,
            transport: "websocket",
            endpoint: "/ws/pi"
          });
        }
      }
    }

    refreshPiStatus();
    const intervalId = window.setInterval(refreshPiStatus, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    async function refreshBackendLiveTelemetry() {
      try {
        const payload = await getLiveTelemetry(userId);
        const liveReadings = backendTelemetryToLiveReadings(payload.telemetry ?? {});
        if (cancelled || Object.keys(liveReadings).length === 0) return;
        setData((current) => {
          if (!current) return current;
          const firstIncomingBattery = Object.keys(liveReadings)[0];
          if (firstIncomingBattery) {
            setDashboardBattery(firstIncomingBattery);
          }
          return {
            ...current,
            liveReadings: mergeLiveReadings(current.liveReadings, liveReadings),
            testSessions: appendLiveReadingsToSessions(current.testSessions ?? [], liveReadings)
          };
        });
      } catch (error) {
        // Firebase remains the primary live source; this backend poll is a dev fallback.
      }
    }

    refreshBackendLiveTelemetry();
    const intervalId = window.setInterval(refreshBackendLiveTelemetry, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [userId]);

  useEffect(() => {
    if (!authEnabled) return undefined;
    return subscribeAuthState((user) => {
      if (!user) return;
      setCurrentUser({
        ...appUser,
        uid: user.uid,
        name: user.displayName || user.email?.split("@")[0] || appUser.name,
        email: user.email ?? "",
        role: appUser.role
      });
      setAuthView("app");
      setActivePage("dashboard");
    });
  }, [userId]);

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
    return subscribeLiveReadings(userId, (liveReadings) => {
      setData((current) => {
        if (!current) return current;
        const nextLiveReadings = mergeLiveReadings(current.liveReadings, liveReadings);
        const firstIncomingBattery = Object.keys(liveReadings ?? {})[0];
        if (firstIncomingBattery) {
          setDashboardBattery(firstIncomingBattery);
        }
        return {
          ...current,
          liveReadings: nextLiveReadings,
          testSessions: appendLiveReadingsToSessions(current.testSessions ?? [], liveReadings)
        };
      });
    });
  }, [firebaseReady, userId]);

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
            uid: user.uid,
            name: user.displayName || userDetails.name || fallbackName,
            email: user.email ?? userDetails.email ?? "",
            role: appUser.role
          });
        } else {
          const user = await signInFirebaseAccount(userDetails);
          setCurrentUser({
            ...appUser,
            uid: user.uid,
            name: user.displayName || fallbackName,
            email: user.email ?? userDetails.email ?? "",
            role: appUser.role
          });
        }
      } else {
        setCurrentUser({
          ...appUser,
          uid: appUser.uid,
          name: userDetails.name || fallbackName,
          email: userDetails.email ?? "",
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
    const response = await startSession({ ...payload, user_id: userId });
    const nextSession = {
      sessionId: response.session_id,
      batteryId: payload.battery_id,
      batteryName: payload.battery_name ?? "",
      type: payload.config.discharge_profile,
      startTime: new Date().toISOString(),
      status: response.status,
      sourceFile: "backend",
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
    const response = await endSession(sessionId, userId);
    if (response.command_sent === false) {
      throw new Error("Stop command was not sent to the Raspberry Pi.");
    }
    const stoppedSession = data?.testSessions?.find((session) => session.sessionId === sessionId);
    const stoppedBatteryId = stoppedSession?.batteryId ?? dashboardBattery ?? initialBattery;
    let finalizedPackets = [];
    try {
      const historical = await getHistorical(sessionId, { userId });
      finalizedPackets = historical.packets ?? [];
    } catch (error) {
      console.warn("Historical refresh after session end failed.", error);
    }

    setData((current) => ({
      ...current,
      liveReadings: {
        ...(current?.liveReadings ?? {}),
        [stoppedBatteryId]: makeZeroLiveReading(stoppedBatteryId)
      },
      testSessions: (current?.testSessions ?? []).map((session) => (
        session.sessionId === sessionId
          ? {
            ...session,
            status: response.status,
            sourceFile: "backend",
            endedAt: new Date().toISOString(),
            readings: finalizedPackets.length > 0
              ? finalizedPackets.map((packet) => backendTelemetryToReading(packet, session.startTime)).filter(Boolean)
              : session.readings
          }
          : session
      ))
    }));
    setDashboardBattery(stoppedBatteryId);
    return response;
  }

  function handlePauseSession(sessionId, paused, deviceId) {
    return sendPiCommand({
      type: paused ? "PAUSE_PROFILE" : "RESUME_PROFILE",
      sessionId,
      deviceId,
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
    soc: Number.isFinite(point.soc) ? point.soc : Math.round(clamp(((point.voltage - 3) / 1.25) * 100, 0, 100)),
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
        piStatus={piStatus}
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
            piStatus={piStatus}
            piConnected={piStatus.connected}
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
