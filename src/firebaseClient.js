import { initializeApp } from "firebase/app";
import { getDatabase, onValue, ref } from "firebase/database";
import { collection, getDocs, getFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

export const firebaseEnabled = Object.values(config).every(Boolean);

let app;
let firestore;
let database;

function ensureFirebase() {
  if (!firebaseEnabled) return null;
  if (!app) {
    app = initializeApp(config);
    firestore = getFirestore(app);
    database = getDatabase(app);
  }
  return { firestore, database };
}

export async function loadFirebaseData() {
  const clients = ensureFirebase();
  if (!clients) return null;

  const [batterySnap, sessionSnap, readingsSnap] = await Promise.all([
    getDocs(collection(clients.firestore, "batteries")),
    getDocs(collection(clients.firestore, "testSessions")),
    getDocs(collection(clients.firestore, "testReadings"))
  ]);

  const readingsBySession = new Map(readingsSnap.docs.map((item) => [item.id, item.data().readings ?? []]));
  const testSessions = sessionSnap.docs.map((item) => ({
    ...item.data(),
    readings: readingsBySession.get(item.id) ?? []
  }));

  return {
    generatedAt: new Date().toISOString(),
    source: "Firebase",
    batteries: batterySnap.docs.map((item) => item.data()),
    testSessions,
    liveReadings: {},
    complianceRules: {
      maxTemperature: 45,
      warningTemperature: 38,
      minSOH: 70,
      warningSOH: 82,
      minVoltage: 2.7,
      maxVoltage: 4.35
    }
  };
}

export function subscribeLiveReadings(callback) {
  const clients = ensureFirebase();
  if (!clients) return () => {};
  return onValue(ref(clients.database, "liveReadings"), (snapshot) => {
    callback(snapshot.val() ?? {});
  });
}
