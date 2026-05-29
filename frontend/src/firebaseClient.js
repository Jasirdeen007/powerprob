import { getApp, getApps, initializeApp } from "firebase/app";
import { collection, doc, getDoc, getDocs, getFirestore } from "firebase/firestore";
import { get, getDatabase, onValue, ref } from "firebase/database";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import { setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

export const authEnabled = firebaseEnabled;

function getFirebaseApp() {
  if (!firebaseEnabled) return null;
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

function getFirebaseAuth() {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

async function readTestSessions(db, userId) {
  const backendSessionsSnapshot = userId
    ? await getDocs(collection(db, "users", userId, "sessions"))
    : { empty: true, docs: [] };
  if (!backendSessionsSnapshot.empty) {
    const sessions = await Promise.all(
      backendSessionsSnapshot.docs.map(async (sessionDoc) => {
        const session = sessionDoc.data();
        if (session.status !== "completed") return null;
        const telemetrySnapshot = await getDocs(collection(db, "users", userId, "sessions", sessionDoc.id, "telemetry"));
        const readings = telemetrySnapshot.docs
          .map((readingDoc) => backendTelemetryToReading(readingDoc.data(), session.started_at))
          .filter(Boolean)
          .sort((a, b) => a.time - b.time);
        if (readings.length === 0) return null;

        return {
          sessionId: session.session_id ?? sessionDoc.id,
          batteryId: session.battery_id ?? sessionDoc.id.split("_").at(-1) ?? "UNKNOWN",
          batteryName: session.battery_name ?? "",
          type: session.config?.discharge_profile ?? "discharge",
          startTime: session.started_at,
          status: session.status ?? "running",
          sourceFile: "backend",
          sourceName: session.command?.source_file ?? "",
          readings
        };
      })
    );
    return sessions.filter(Boolean);
  }

  const sessionsSnapshot = await getDocs(collection(db, "testSessions"));
  const sessions = await Promise.all(
    sessionsSnapshot.docs.map(async (sessionDoc) => {
      const session = sessionDoc.data();
      const readingsSnapshot = await getDoc(doc(db, "testReadings", sessionDoc.id));
      const readings = readingsSnapshot.exists() ? readingsSnapshot.data()?.readings ?? [] : [];
      return {
        ...session,
        sessionId: session.sessionId ?? sessionDoc.id,
        readings
      };
    })
  );
  return sessions;
}

export function backendTelemetryToReading(packet, startedAt) {
  const timestampMs = new Date(packet.timestamp).getTime();
  const startedMs = new Date(startedAt ?? packet.timestamp).getTime();
  if (!Number.isFinite(timestampMs)) return null;

  return {
    time: Number.isFinite(startedMs) ? Math.max(0, (timestampMs - startedMs) / 1000) : 0,
    voltage: Number(packet.pack_voltage ?? 0),
    current: Number(packet.current ?? 0),
    temperature: Number(packet.temperature?.battery ?? 0),
    action: packet.event ?? "",
    timestamp: packet.timestamp,
    soc: Number(packet.derived?.soc ?? NaN),
    soh: Number(packet.derived?.soh ?? NaN),
    rul: Number(packet.derived?.rul ?? NaN)
  };
}

function inferBatteryId(sessionId) {
  const parts = String(sessionId ?? "").split("_");
  return parts.at(-1) || "B0047";
}

export function backendTelemetryToLiveReadings(telemetryBySession) {
  return Object.fromEntries(
    Object.entries(telemetryBySession ?? {}).flatMap(([sessionId, value]) => {
      const packet = value?.latest ?? value;
      if (!packet || typeof packet !== "object") return [];

      const rawPackets = value?.packets && typeof value.packets === "object"
        ? Object.values(value.packets)
        : [packet];
      const sortedPackets = rawPackets
        .filter((item) => item && typeof item === "object" && item.timestamp)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const startedAt = sortedPackets[0]?.timestamp ?? packet.timestamp;
      const stream = sortedPackets
        .map((item) => {
          const reading = backendTelemetryToReading(item, startedAt);
          return reading ? { ...reading, sessionId: item.session_id ?? sessionId } : null;
        })
        .filter(Boolean);
      if (stream.length === 0) return [];

      const batteryId = packet.battery_id ?? inferBatteryId(packet.session_id ?? sessionId);

      return [
        [
          batteryId,
          {
            batteryId,
            batteryName: packet.battery_name ?? "",
            sessionId: packet.session_id ?? sessionId,
            mode: packet.mode ?? "DISCHARGE",
            status: packet.alerts?.length ? "warning" : "healthy",
            soh: Number(packet.derived?.soh ?? 100),
            stream
          }
        ]
      ];
    })
  );
}

export async function loadFirebaseData(userId) {
  const app = getFirebaseApp();
  if (!app) return null;

  const db = getFirestore(app);
  const rtdb = getDatabase(app);

  const [batteriesSnapshot, testSessions, backendTelemetrySnapshot] = await Promise.all([
    getDocs(collection(db, "batteries")),
    readTestSessions(db, userId),
    userId ? get(ref(rtdb, `users/${userId}/telemetry`)) : Promise.resolve({ exists: () => false })
  ]);

  const batteries = batteriesSnapshot.docs.map((batteryDoc) => ({
    batteryId: batteryDoc.data().batteryId ?? batteryDoc.id,
    ...batteryDoc.data()
  }));

  const backendLiveReadings = backendTelemetryToLiveReadings(
    backendTelemetrySnapshot.exists() ? backendTelemetrySnapshot.val() ?? {} : {}
  );
  return {
    source: "firebase",
    generatedAt: new Date().toISOString(),
    batteries,
    testSessions,
    liveReadings: backendLiveReadings
  };
}

export function subscribeLiveReadings(userId, onLiveReadings) {
  const app = getFirebaseApp();
  if (!app || !userId) return undefined;

  const rtdb = getDatabase(app);
  return onValue(ref(rtdb, `users/${userId}/telemetry`), (snapshot) => {
    onLiveReadings(backendTelemetryToLiveReadings(snapshot.val() ?? {}));
  });
}

export function subscribeAuthState(onAuthState) {
  const auth = getFirebaseAuth();
  if (!auth) return undefined;
  return onAuthStateChanged(auth, onAuthState);
}

function fallbackDisplayName(email, name) {
  return name?.trim() || email.split("@")[0] || "Battery Test User";
}

async function saveUserProfile(user, { name, role }) {
  const app = getFirebaseApp();
  if (!app) return;

  const db = getFirestore(app);
  try {
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || fallbackDisplayName(user.email || "", name),
      role: role || "User",
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.warn("Firebase Auth user created, but profile document write failed.", error);
  }
}

export async function createFirebaseAccount({ email, password, name, role }) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth is not configured.");

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const displayName = fallbackDisplayName(email, name);
  await updateProfile(credential.user, { displayName });
  await saveUserProfile(credential.user, { name: displayName, role });
  return credential.user;
}

export async function signInFirebaseAccount({ email, password }) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth is not configured.");

  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOutFirebaseAccount() {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}

export async function sendPasswordReset(email) {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error("Password reset requires Firebase Auth to be configured.");
  }
  if (!email?.trim()) {
    throw new Error("Enter your email address to reset your password.");
  }
  await sendPasswordResetEmail(auth, email.trim());
}
