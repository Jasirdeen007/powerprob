import { getApp, getApps, initializeApp } from "firebase/app";
import { collection, doc, getDoc, getDocs, getFirestore } from "firebase/firestore";
import { get, getDatabase, onValue, ref } from "firebase/database";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
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

async function readTestSessions(db) {
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

export async function loadFirebaseData() {
  const app = getFirebaseApp();
  if (!app) return null;

  const db = getFirestore(app);
  const rtdb = getDatabase(app);

  const [batteriesSnapshot, testSessions, liveReadingsSnapshot] = await Promise.all([
    getDocs(collection(db, "batteries")),
    readTestSessions(db),
    get(ref(rtdb, "liveReadings"))
  ]);

  const batteries = batteriesSnapshot.docs.map((batteryDoc) => ({
    batteryId: batteryDoc.data().batteryId ?? batteryDoc.id,
    ...batteryDoc.data()
  }));

  return {
    source: "firebase",
    generatedAt: new Date().toISOString(),
    batteries,
    testSessions,
    liveReadings: liveReadingsSnapshot.exists() ? liveReadingsSnapshot.val() ?? {} : {}
  };
}

export function subscribeLiveReadings(onLiveReadings) {
  const app = getFirebaseApp();
  if (!app) return undefined;

  const rtdb = getDatabase(app);
  return onValue(ref(rtdb, "liveReadings"), (snapshot) => {
    onLiveReadings(snapshot.val() ?? {});
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