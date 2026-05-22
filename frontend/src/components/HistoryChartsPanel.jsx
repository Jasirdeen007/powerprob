import TelemetryChartCard from "./TelemetryChartCard";

export default function HistoryChartsPanel({ records }) {
  if (!records?.length) {
    return (
      <div className="history-charts-empty panel">
        <p>No records match the current filters.</p>
      </div>
    );
  }

  const enriched = records.map((row, index, list) => ({
    ...row,
    time: typeof row.time === "number" ? row.time : Number(row.time) || index,
    soc: row.soc ?? Math.round(Math.max(0, 100 - (index / Math.max(1, list.length)) * 40)),
    soh: row.soh ?? Number((99 - (index / Math.max(1, list.length)) * 5).toFixed(1)),
    power: row.power ?? Number((row.voltage * row.current).toFixed(2))
  }));

  return (
    <section className="history-charts-panel">
      <div className="history-charts-panel-head">
        <h2>Telemetry trends</h2>
        <span>{enriched.length} readings</span>
      </div>
      <div className="history-charts-grid">
        <TelemetryChartCard title="Voltage" metricKey="voltage" unit="V" data={enriched} compact showToggles />
        <TelemetryChartCard title="Current" metricKey="current" unit="A" data={enriched} compact showToggles />
        <TelemetryChartCard title="Temperature" metricKey="temperature" unit="°C" data={enriched} compact showToggles />
        <TelemetryChartCard title="SOC" metricKey="soc" unit="%" data={enriched} forceYRange={{ min: 0, max: 100 }} compact showToggles />
        <TelemetryChartCard title="SOH" metricKey="soh" unit="%" data={enriched} forceYRange={{ min: 0, max: 100 }} compact showToggles />
        <TelemetryChartCard title="Power" metricKey="power" unit="W" data={enriched} compact showToggles />
      </div>
    </section>
  );
}
