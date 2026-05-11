import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const datasetRoot = path.join(root, "battery_dataset", "cleaned_dataset");
const metadataPath = path.join(datasetRoot, "metadata.csv");
const dataDir = path.join(datasetRoot, "data");
const outPath = path.join(root, "public", "demo-data.json");
const srcOutPath = path.join(root, "src", "demo-data.json");

const selectedBatteries = new Set(["B0047", "B0048", "B0045", "B0046", "B0005"]);
const maxSessionsPerBattery = 12;
const maxReadingsPerSession = 80;

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function toNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNasaDate(value, index) {
  const numbers = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length >= 6) {
    const [year, month, day, hour, minute, second] = numbers;
    return new Date(year, month - 1, day, hour, minute, Math.floor(second)).toISOString();
  }
  return new Date(Date.UTC(2026, 3, 22, 9, index * 15)).toISOString();
}

function sampleRows(rows) {
  if (rows.length <= maxReadingsPerSession) return rows;
  const step = Math.ceil(rows.length / maxReadingsPerSession);
  return rows.filter((_, index) => index % step === 0).slice(0, maxReadingsPerSession);
}

function statusFromMetrics({ soh, maxTemperature, re }) {
  if (maxTemperature >= 45 || soh < 70 || (re ?? 0) > 0.09) return "critical";
  if (maxTemperature >= 38 || soh < 82 || (re ?? 0) > 0.07) return "warning";
  return "healthy";
}

function socFromVoltage(voltage) {
  if (voltage == null) return 0;
  return Math.max(0, Math.min(100, ((voltage - 3.0) / 1.25) * 100));
}

function main() {
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Missing metadata file: ${metadataPath}`);
  }

  const sessionCounts = new Map();
  const metadata = readCsv(metadataPath)
    .filter((row) => selectedBatteries.has(row.battery_id))
    .filter((row) => row.type === "charge" || row.type === "discharge")
    .filter((row) => {
      const count = sessionCounts.get(row.battery_id) ?? 0;
      if (count >= maxSessionsPerBattery) return false;
      sessionCounts.set(row.battery_id, count + 1);
      return true;
    });

  const initialCapacity = new Map();
  for (const row of metadata) {
    const capacity = toNumber(row.Capacity);
    if (capacity && !initialCapacity.has(row.battery_id)) {
      initialCapacity.set(row.battery_id, capacity);
    }
  }

  const testSessions = [];
  const batteriesById = new Map();

  metadata.forEach((row, index) => {
    const filePath = path.join(dataDir, row.filename);
    if (!fs.existsSync(filePath)) return;

    const readings = sampleRows(readCsv(filePath)).map((reading) => ({
      time: toNumber(reading.Time, 0),
      voltage: toNumber(reading.Voltage_measured, 0),
      current: toNumber(reading.Current_measured, 0),
      temperature: toNumber(reading.Temperature_measured, 0)
    }));

    const capacity = toNumber(row.Capacity);
    const firstCapacity = initialCapacity.get(row.battery_id) || capacity || 1.8;
    const soh = Math.round(((capacity || firstCapacity) / firstCapacity) * 1000) / 10;
    const temperatures = readings.map((reading) => reading.temperature);
    const maxTemperature = Math.max(...temperatures);
    const avgVoltage = readings.reduce((sum, item) => sum + item.voltage, 0) / readings.length;
    const re = toNumber(row.Re);
    const status = statusFromMetrics({ soh, maxTemperature, re });
    const sessionId = `${row.battery_id}-${row.uid}`;

    testSessions.push({
      sessionId,
      batteryId: row.battery_id,
      testId: Number(row.test_id),
      uid: Number(row.uid),
      type: row.type,
      startTime: parseNasaDate(row.start_time, index),
      ambientTemperature: toNumber(row.ambient_temperature, 24),
      capacity,
      re,
      rct: toNumber(row.Rct),
      status,
      sourceFile: row.filename,
      summary: {
        soh,
        estimatedSoc: Math.round(socFromVoltage(avgVoltage)),
        maxTemperature: Math.round(maxTemperature * 10) / 10,
        avgVoltage: Math.round(avgVoltage * 1000) / 1000,
        samples: readings.length
      },
      readings
    });

    const current = batteriesById.get(row.battery_id) ?? {
      batteryId: row.battery_id,
      chemistry: "Li-ion",
      latestCapacity: capacity,
      latestSOH: soh,
      totalTests: 0,
      lastTestAt: null,
      status: "healthy"
    };
    current.totalTests += 1;
    current.latestCapacity = capacity ?? current.latestCapacity;
    current.latestSOH = soh;
    current.lastTestAt = parseNasaDate(row.start_time, index);
    if (status === "critical" || (status === "warning" && current.status !== "critical")) {
      current.status = status;
    }
    batteriesById.set(row.battery_id, current);
  });

  const liveSource = testSessions.find((session) => session.batteryId === "B0047" && session.readings.length > 10) ?? testSessions[0];
  const latestReading = liveSource.readings.at(-1);
  const liveReadings = {
    [liveSource.batteryId]: {
      batteryId: liveSource.batteryId,
      voltage: latestReading.voltage,
      current: latestReading.current,
      temperature: latestReading.temperature,
      time: latestReading.time,
      soc: liveSource.summary.estimatedSoc,
      soh: liveSource.summary.soh,
      status: liveSource.status,
      updatedAt: new Date().toISOString(),
      stream: liveSource.readings
    }
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "NASA battery dataset cleaned CSV sample",
    batteries: [...batteriesById.values()],
    testSessions,
    liveReadings,
    complianceRules: {
      maxTemperature: 45,
      warningTemperature: 38,
      minSOH: 70,
      warningSOH: 82,
      minVoltage: 2.7,
      maxVoltage: 4.35
    }
  };

  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(srcOutPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Generated ${outPath}`);
  console.log(`Generated ${srcOutPath}`);
  console.log(`${payload.batteries.length} batteries, ${payload.testSessions.length} test sessions`);
}

main();
