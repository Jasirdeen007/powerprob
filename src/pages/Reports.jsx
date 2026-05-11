import { Download } from "lucide-react";

function Reports({ selectedSession }) {
  function downloadReport(type) {
    const rows = [
      ["Battery ID", selectedSession.batteryId],
      ["Session", selectedSession.sessionId],
      ["Type", selectedSession.type],
      ["Start time", selectedSession.startTime],
      ["SOH", `${selectedSession.summary.soh}%`],
      ["Max temperature", `${selectedSession.summary.maxTemperature} C`],
      ["Average voltage", `${selectedSession.summary.avgVoltage} V`]
    ];
    const content = type === "json"
      ? JSON.stringify({ session: selectedSession }, null, 2)
      : rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([content], { type: type === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedSession.sessionId}-report.${type === "json" ? "json" : "csv"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel reports">
      <div className="panel-head">
        <h2>Reports</h2>
        <span>{selectedSession.sessionId}</span>
      </div>
      <p>Session exports use CSV and JSON. Firebase Storage can attach to the same report metadata once credentials are added.</p>
      <div className="report-actions">
        <button onClick={() => downloadReport("csv")}><Download size={18} /> Export CSV</button>
        <button onClick={() => downloadReport("json")}><Download size={18} /> Export JSON</button>
      </div>
    </section>
  );
}

export default Reports;
