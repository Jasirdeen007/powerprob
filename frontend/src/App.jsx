import { useEffect, useMemo, useRef, useState } from "react";
import { Info, LayoutPanelTop, X } from "lucide-react";
import Header from "./components/Header";
import SessionTimeoutWarning from "./components/SessionTimeoutWarning";
import { endSession, getEsp32Status, getHistorical, getLiveTelemetry, getProfiles, getSessions, sendEsp32Command, startSession } from "./backendClient";
import { appUser } from "./data/appConfig";
import {
  authEnabled,
  createFirebaseAccount,
  firebaseEnabled,
  googleLogin,
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
import ResetPassword from "./pages/ResetPassword";
import HistoryAnalytics from "./pages/historyAnalytics";
import { clamp } from "./lib/battery";

function AppFooter() {
  return (
    <footer className="app-footer" />
  );
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

function resetLiveReadings(currentLiveReadings, fallbackBatteryId) {
  const ids = Object.keys(currentLiveReadings ?? {});
  const batteryIds = ids.length > 0 ? ids : [fallbackBatteryId];
  return Object.fromEntries(
    batteryIds.map((batteryId) => [batteryId, makeZeroLiveReading(batteryId)])
  );
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
      sourceFile: current?.sourceFile ?? "esp32-live",
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
  const initialAuthView = (() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("oobCode")) {
      return "reset-password";
    }
    return authEnabled ? "checking" : "landing";
  })();
  const [authView, setAuthView] = useState(initialAuthView);
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedBattery, setSelectedBattery] = useState(initialBattery);
  const [dashboardBattery, setDashboardBattery] = useState(initialBattery);
  const [currentUser, setCurrentUser] = useState(appUser);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("powerprobe-theme") || "light";
    } catch (_) {
      return "light";
    }
  });
  const [piStatus, setPiStatus] = useState({
    connected: false,
    transport: "websocket",
    endpoint: "/esp32/status"
  });
  const [activeRun, setActiveRun] = useState({
    sessionId: "",
    deviceId: "",
    isRunning: false,
    isPaused: false,
    createdAt: 0
  });
  
  const failedAttemptsRef = useRef(0);
  const lockoutUntilRef = useRef(0);
  const statusMissCountRef = useRef(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
  const WARNING_BEFORE_MS = 5 * 60 * 1000;
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [sessionWarningRemaining, setSessionWarningRemaining] = useState(0);
  const lastActivityRef = useRef(Date.now());
  const logoutTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const warningIntervalRef = useRef(null);
  
  const userId = currentUser?.uid || appUser.uid;

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("powerprobe-theme", theme);
    } catch (_) {
      // Ignore storage failures in private or restricted browser modes.
    }
  }, [theme]);

  useEffect(() => {
    if (authView !== "app") return;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
      setShowSessionWarning(false);

      logoutTimerRef.current = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT_MS);

      warningTimerRef.current = setTimeout(() => {
        setShowSessionWarning(true);
        const remaining = Math.ceil(WARNING_BEFORE_MS / 1000);
        setSessionWarningRemaining(remaining);
        
        warningIntervalRef.current = setInterval(() => {
          setSessionWarningRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(warningIntervalRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);
    };

    const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((event) => window.addEventListener(event, resetActivity));
    resetActivity();

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, resetActivity));
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    };
  }, [authView]);

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
  }, [initialBattery, userId]);

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

        const backendSessions = await Promise.all((sessionsPayload.sessions ?? []).map(async (session) => {
          let readings = [];
          if (session.status === "completed") {
            try {
              const historical = await getHistorical(session.session_id, { userId });
              readings = (historical.packets ?? [])
                .map((packet) => backendTelemetryToReading(packet, session.started_at))
                .filter(Boolean);
            } catch (error) {
              console.warn(`Historical packets failed to load for ${session.session_id}.`, error);
            }
          }

          return {
            sessionId: session.session_id,
            batteryId: session.battery_id,
            batteryName: session.battery_name ?? "",
            deviceId: session.device_id ?? "",
            type: session.config?.discharge_profile ?? "discharge",
            startTime: session.started_at,
            status: session.status,
            sourceFile: "backend",
            readings
          };
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
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    async function refreshEsp32Status() {
      try {
        const status = await getEsp32Status();
        if (!cancelled) {
          setPiStatus(status);
          const activeSessionIds = new Set([
            ...Object.keys(status?.active_sessions ?? {}),
            ...Object.values(status?.device_sessions ?? {}),
            ...Object.values(status?.devices ?? {}).map((device) => device?.active_session_id)
          ].filter(Boolean));
          const anyDeviceFresh = Object.values(status?.devices ?? {}).some((d) => d?.available);
          setActiveRun((current) => {
            if (!current.sessionId) {
              statusMissCountRef.current = 0;
              return current;
            }
            if (current.createdAt && Date.now() - current.createdAt < 10000) return current;
            const sessionConfirmed = activeSessionIds.has(current.sessionId) && anyDeviceFresh;
            if (sessionConfirmed) {
              statusMissCountRef.current = 0;
              return current;
            }
            statusMissCountRef.current += 1;
            if (statusMissCountRef.current >= 3) {
              statusMissCountRef.current = 0;
              return { sessionId: "", deviceId: "", isRunning: false, isPaused: false, createdAt: 0 };
            }
            return current;
          });
        }
      } catch (error) {
        if (!cancelled) {
          setPiStatus({
            connected: false,
            transport: "mqtt",
            endpoint: "/esp32/status"
          });
          statusMissCountRef.current += 1;
          if (statusMissCountRef.current >= 3) {
            statusMissCountRef.current = 0;
            setActiveRun({ sessionId: "", deviceId: "", isRunning: false, isPaused: false, createdAt: 0 });
          }
        }
      }
    }

    refreshEsp32Status();
    const intervalId = window.setInterval(refreshEsp32Status, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    async function refreshBackendLiveTelemetry() {
      try {
        const payload = await getLiveTelemetry(userId, { scope: "all" });
        const liveReadings = backendTelemetryToLiveReadings(payload.telemetry ?? {});
        if (cancelled) return;
        setData((current) => {
          if (!current) return current;
          if (Object.keys(liveReadings).length === 0) {
            return {
              ...current,
              liveReadings: resetLiveReadings(current.liveReadings, dashboardBattery || initialBattery)
            };
          }
          const firstIncomingBattery = Object.keys(liveReadings)[0];
          if (firstIncomingBattery) {
            setDashboardBattery(firstIncomingBattery);
          }
          return {
            ...current,
            liveReadings: mergeLiveReadings(current.liveReadings, liveReadings)
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
  }, [dashboardBattery, initialBattery, userId]);

  useEffect(() => {
    if (!authEnabled) return undefined;
    return subscribeAuthState((user) => {
      if (!user) {
        setAuthView((current) => (current === "checking" ? "landing" : current));
        return;
      }
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
    return subscribeLiveReadings(userId, (liveReadings) => {
      setData((current) => {
        if (!current) return current;
        if (Object.keys(liveReadings ?? {}).length === 0) {
          return current;
        }
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

  const MAX_FAILED_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 60 * 1000;
  const ATTEMPT_WINDOW_MS = 2 * 60 * 1000;

  async function handleAuthSubmit(userDetails) {
    if (isLockedOut) {
      setAuthError(`Too many attempts. Please wait ${lockoutRemaining} seconds.`);
      return;
    }

    setAuthError("");
    setAuthPending(true);

    try {
      const fallbackName = userDetails.email ? userDetails.email.split("@")[0] : appUser.name;

      if (!authEnabled) {
        setAuthError("Authentication requires Firebase configuration. Please create a .env file with your Firebase credentials.");
        return;
      }

      if (userDetails.mode === "google") {
        const user = await googleLogin();
        setCurrentUser({
          ...appUser,
          uid: user.uid,
          name: user.displayName || user.email?.split("@")[0] || appUser.name,
          email: user.email ?? "",
          photoURL: user.photoURL ?? "",
          role: appUser.role
        });
      } else if (userDetails.mode === "signup") {
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

      failedAttemptsRef.current = 0;
      lockoutUntilRef.current = 0;
      setIsLockedOut(false);
      setAuthView("app");
      setActivePage("dashboard");
    } catch (error) {
      console.error("[Auth] Error:", error?.code, error?.message, error);
      
      const firebaseErrorMessages = {
        "auth/user-not-found": "Invalid email or password.",
        "auth/wrong-password": "Invalid email or password.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/email-already-in-use": "An account with this email already exists.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/too-many-requests": "Account temporarily locked due to multiple failed attempts. Try again later or reset your password.",
        "auth/invalid-credential": "Invalid email or password.",
        "auth/network-request-failed": "Network error. Please check your connection.",
        "auth/user-disabled": "This account has been disabled. Contact support.",
        "auth/operation-not-allowed": "Google sign-in is not enabled. Please enable it in your Firebase Console under Authentication > Sign-in method.",
        "auth/popup-closed-by-user": "Sign-in popup was closed. Please try again.",
        "auth/popup-blocked": "Popup was blocked by your browser. Please allow popups for this site and try again.",
        "auth/cancelled-popup-request": "Sign-in was cancelled. Please try again.",
        "auth/unauthorized-domain": "This domain is not authorized for Google sign-in. Add it in Firebase Console under Authentication > Settings > Authorized domains."
      };
      
      const errorCode = error?.code || "";
      const safeMessage = firebaseErrorMessages[errorCode]
        || (error instanceof Error ? "Authentication failed. Please try again." : "Authentication failed. Please try again.");
      
      if (userDetails.mode === "login") {
        const now = Date.now();
        if (now - (lockoutUntilRef.current - LOCKOUT_DURATION_MS) > ATTEMPT_WINDOW_MS) {
          failedAttemptsRef.current = 0;
        }
        
        failedAttemptsRef.current++;
        
        if (failedAttemptsRef.current >= MAX_FAILED_ATTEMPTS) {
          lockoutUntilRef.current = now + LOCKOUT_DURATION_MS;
          setIsLockedOut(true);
          setLockoutRemaining(Math.ceil(LOCKOUT_DURATION_MS / 1000));
          
          const lockoutInterval = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((lockoutUntilRef.current - Date.now()) / 1000));
            setLockoutRemaining(remaining);
            if (remaining <= 0) {
              clearInterval(lockoutInterval);
              setIsLockedOut(false);
              failedAttemptsRef.current = 0;
            }
          }, 1000);
        }
      }
      
      setAuthError(safeMessage);
    } finally {
      setAuthPending(false);
    }
  }

  async function handleLogout() {
    if (authEnabled) {
      await signOutFirebaseAccount();
    }
    
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    
    try {
      localStorage.removeItem("powerprobe_recent_emails");
      localStorage.removeItem("powerprobe_custom_chemistries");
    } catch (e) {
      // Ignore storage cleanup errors
    }
    
    setData(makeStaticInitialData);
    setShowSessionWarning(false);
    setAuthView("landing");
    setCurrentUser(appUser);
    setActivePage("dashboard");
    setActiveRun({ sessionId: "", deviceId: "", isRunning: false, isPaused: false, createdAt: 0 });
  }

  function handleStaySignedIn() {
    lastActivityRef.current = Date.now();
    setShowSessionWarning(false);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    
    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT_MS);
    
    warningTimerRef.current = setTimeout(() => {
      setShowSessionWarning(true);
      const remaining = Math.ceil(WARNING_BEFORE_MS / 1000);
      setSessionWarningRemaining(remaining);
      
      warningIntervalRef.current = setInterval(() => {
        setSessionWarningRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(warningIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);
  }

  async function handleStartSession(payload) {
    const response = await startSession({ ...payload, user_id: userId });
    setActiveRun({
      sessionId: response.session_id,
      deviceId: response.device_id ?? "",
      isRunning: true,
      isPaused: false,
      createdAt: Date.now()
    });
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
    setActiveRun({
      sessionId: "",
      deviceId: "",
      isRunning: false,
      isPaused: false
    });
    return response;
  }

  async function handlePauseSession(sessionId, paused, deviceId) {
    const response = await sendEsp32Command({
      type: paused ? "PAUSE_PROFILE" : "RESUME_PROFILE",
      sessionId,
      deviceId,
      command: { paused }
    });
    setActiveRun((current) => (
      current.sessionId === sessionId
        ? { ...current, isPaused: paused }
        : current
    ));
    return response;
  }

  if (authView === "checking") {
    return (
      <main className="app-auth-loading">
        <div className="app-auth-loading-card">
          <strong>PowerProbe</strong>
          <span>Restoring your session...</span>
        </div>
      </main>
    );
  }

  if (authView === "reset-password") {
    return (
      <ResetPassword
        onBackToLogin={() => {
          window.history.replaceState({}, "", window.location.pathname);
          setAuthView("login");
        }}
      />
    );
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
      />
      <main className="app-content">
        {activePage === "dashboard" && (
          <Dashboard
            data={data}
            livePoint={livePoint}
            liveStream={live.stream}
            activeBattery={live.batteryId ?? dashboardBattery}
            activeSession={activeRun}
            selectedSession={dashboardSession}
            profiles={profiles}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onPauseSession={handlePauseSession}
            piStatus={piStatus}
            userId={userId}
          />
        )}
        {activePage === "traceability" && (
          <HistoryAnalytics data={data} selectedBattery={selectedBattery} onBatteryChange={setSelectedBattery} />
        )}
      </main>
      <AppFooter />
      
      {showSessionWarning && (
        <SessionTimeoutWarning
          remainingSeconds={sessionWarningRemaining}
          onStaySignedIn={handleStaySignedIn}
          onSignOut={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
