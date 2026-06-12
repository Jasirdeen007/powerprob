import { useEffect, useMemo, useState } from "react";
import TelemetryChartCard from "./TelemetryChartCard";

function enrichRecords(records) {
  const chronological = [...records].sort((a, b) => {
    const aTime = Number(a.timestampMs);
    const bTime = Number(b.timestampMs);
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
    return (Number(a.time) || 0) - (Number(b.time) || 0);
  });

  return chronological.map((row, index, list) => ({
    ...row,
    originalTime: typeof row.time === "number" ? row.time : Number(row.time) || index,
    time: index,
    soc: row.soc ?? Math.round(Math.max(0, 100 - (index / Math.max(1, list.length)) * 40)),
    soh: row.soh ?? Number((99 - (index / Math.max(1, list.length)) * 5).toFixed(1)),
    power: row.power ?? Number((row.voltage * row.current).toFixed(2))
  }));
}

const HISTORY_X_LABEL = "Reading time (1 second steps)";

function axisLabels(ylabel) {
  return { xlabel: HISTORY_X_LABEL, ylabel };
}

function ChartSet({ records, label }) {
  const enriched = enrichRecords(records);
  if (enriched.length === 0) {
    return (
      <div className="history-charts-empty panel">
        <p>No telemetry readings found for this battery.</p>
      </div>
    );
  }

  return (
    <div className="history-battery-chart-set">
      {label ? <h3>{label} <span>{enriched.length} readings</span></h3> : null}
      <div className="history-charts-grid">
        <TelemetryChartCard title="Voltage" metricKey="voltage" unit="V" data={enriched} customAxisLabels={axisLabels("Voltage (V)")} compact showToggles={false} autoFollowLatest={false} />
        <TelemetryChartCard title="Current" metricKey="current" unit="A" data={enriched} customAxisLabels={axisLabels("Current (A)")} compact showToggles={false} autoFollowLatest={false} />
        <TelemetryChartCard title="Temperature" metricKey="temperature" unit="C" data={enriched} customAxisLabels={axisLabels("Temperature (C)")} compact showToggles={false} autoFollowLatest={false} />
        <TelemetryChartCard title="SOC" metricKey="soc" unit="%" data={enriched} forceYRange={{ min: 0, max: 100 }} customAxisLabels={axisLabels("SOC (%)")} compact showToggles={false} autoFollowLatest={false} />
        <TelemetryChartCard title="SOH" metricKey="soh" unit="%" data={enriched} forceYRange={{ min: 0, max: 100 }} customAxisLabels={axisLabels("SOH (%)")} compact showToggles={false} autoFollowLatest={false} />
        <TelemetryChartCard title="Power" metricKey="power" unit="W" data={enriched} customAxisLabels={axisLabels("Power (W)")} compact showToggles={false} autoFollowLatest={false} />
      </div>
    </div>
  );
}

export default function HistoryChartsPanel({ records, batteries = [] }) {
  const [selectedBatteryId, setSelectedBatteryId] = useState("");

  const batteryList = batteries.length > 0
    ? batteries
    : Array.from(new Map((records ?? []).map((row) => [row.batteryId, { batteryId: row.batteryId, batteryName: row.batteryName }])).values());
  const activeBatteryId = selectedBatteryId || batteryList[0]?.batteryId || "";

  useEffect(() => {
    if (!selectedBatteryId && batteryList[0]?.batteryId) {
      setSelectedBatteryId(batteryList[0].batteryId);
    }
  }, [batteryList, selectedBatteryId]);

  const filteredRecords = activeBatteryId
    ? (records ?? []).filter((row) => row.batteryId === activeBatteryId)
    : (records ?? []);

  const batterySummary = useMemo(() => {
    const battery = batteryList.find((item) => item.batteryId === activeBatteryId);
    return battery?.batteryName ? `${battery.batteryName} (${activeBatteryId})` : activeBatteryId;
  }, [activeBatteryId, batteryList]);

  if (!records?.length) {
    return (
      <div className="history-charts-empty panel">
        <p>No records match the current filters.</p>
      </div>
    );
  }

  return (
    <section className="history-charts-panel">
      <div className="history-charts-panel-head">
        <div>
          <h2>Telemetry trends</h2>
          <span>{filteredRecords.length} readings | {batterySummary}</span>
        </div>
        <div className="history-chart-filter">
            <label>
              Battery trend
              <select value={activeBatteryId} onChange={(event) => setSelectedBatteryId(event.target.value)}>
                {batteryList.map((battery) => (
                  <option key={battery.batteryId} value={battery.batteryId}>
                    {battery.batteryName ? `${battery.batteryName} (${battery.batteryId})` : battery.batteryId}
                  </option>
                ))}
              </select>
            </label>
          </div>
      </div>

      <ChartSet records={filteredRecords} />
    </section>
  );
}
