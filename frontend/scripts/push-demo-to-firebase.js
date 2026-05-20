import fs from "node:fs";
import path from "node:path";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";
import { collection, doc, getFirestore, writeBatch } from "firebase/firestore";
import { getFirebaseConfig } from "./firebase-config.js";

const root = process.cwd();
const demoPath = path.join(root, "public", "demo-data.json");

function compactSession(session) {
  return {
    sessionId: session.sessionId,
    batteryId: session.batteryId,
    testId: session.testId,
    uid: session.uid,
    type: session.type,
    startTime: session.startTime,
    ambientTemperature: session.ambientTemperature,
    capacity: session.capacity,
    re: session.re,
    rct: session.rct,
    status: session.status,
    sourceFile: session.sourceFile,
    summary: session.summary
  };
}

async function commitInChunks(db, writes, chunkSize = 450) {
  for (let index = 0; index < writes.length; index += chunkSize) {
    const batch = writeBatch(db);
    for (const write of writes.slice(index, index + chunkSize)) {
      batch.set(write.ref, write.data, { merge: true });
    }
    await batch.commit();
  }
}

async function main() {
  if (!fs.existsSync(demoPath)) {
    throw new Error("Missing public/demo-data.json. Keep the bundled demo data before seeding Firebase.");
  }

  const data = JSON.parse(fs.readFileSync(demoPath, "utf8"));
  const app = initializeApp(getFirebaseConfig());
  const db = getFirestore(app);
  const rtdb = getDatabase(app);

  const writes = [];
  for (const battery of data.batteries) {
    writes.push({ ref: doc(collection(db, "batteries"), battery.batteryId), data: battery });
  }
  for (const session of data.testSessions) {
    writes.push({ ref: doc(collection(db, "testSessions"), session.sessionId), data: compactSession(session) });
    writes.push({
      ref: doc(collection(db, "testReadings"), session.sessionId),
      data: {
        sessionId: session.sessionId,
        batteryId: session.batteryId,
        readings: session.readings
      }
    });
  }

  await commitInChunks(db, writes);
  await set(ref(rtdb, "liveReadings"), data.liveReadings);

  console.log(`Seeded ${data.batteries.length} batteries and ${data.testSessions.length} sessions.`);
  console.log("Realtime Database path updated: /liveReadings");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
