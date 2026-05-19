import { useMemo } from "react";
import LineChart from "./LineChart";
import PieChart from "./PieChart";
import StatCard from "./StatCard";
import { Zap, Thermometer, Gauge, Activity, TrendingUp } from "lucide-react";

function DashboardCharts({ records }) {
  const analysis = useMemo(() => {
    if (!records || records.length === 0) {
      return null;
    }

    // Group records by mode for charts
    const chargeReadings = records.filter((r) => r.mode === "CHARGE");
    const dischargeReadings = records.filter((r) => r.mode === "DISCHARGE");
    const idleReadings = records.filter((r) => r.mode === "IDLE");

    // Calculate statistics
    const allVoltages = records.map((r) => r.voltage).filter(Number.isFinite);
    const allCurrents = records.map((r) => r.current).filter(Number.isFinite);
    const allTemps = records.map((r) => r.temperature).filter(Number.isFinite);

    const avgVoltage = allVoltages.length ? allVoltages.reduce((a, b) => a + b, 0) / allVoltages.length : 0;
    const maxVoltage = allVoltages.length ? Math.max(...allVoltages) : 0;
    const minVoltage = allVoltages.length ? Math.min(...allVoltages) : 0;
    const avgCurrent = allCurrents.length ? allCurrents.reduce((a, b) => a + b, 0) / allCurrents.length : 0;
    const maxCurrent = allCurrents.length ? Math.max(...allCurrents) : 0;
    const minCurrent = allCurrents.length ? Math.min(...allCurrents) : 0;
    const avgTemp = allTemps.length ? allTemps.reduce((a, b) => a + b, 0) / allTemps.length : 0;
    const maxTemp = allTemps.length ? Math.max(...allTemps) : 0;
    const minTemp = allTemps.length ? Math.min(...allTemps) : 0;

    const stats = {
      avgVoltage,
      maxVoltage,
      minVoltage,
      avgCurrent,
      maxCurrent,
      minCurrent,
      avgTemp,
      maxTemp,
      minTemp,
      modeDistribution: {
        CHARGE: chargeReadings.length,
        DISCHARGE: dischargeReadings.length,
        IDLE: idleReadings.length
      }
    };

    return {
      chargeReadings,
      dischargeReadings,
      idleReadings,
      stats,
      allRecords: records
    };
  }, [records]);

  if (!analysis) {
    return <div className="dashboard-empty">No data available for visualization</div>;
  }

  const { chargeReadings, dischargeReadings, idleReadings, stats, allRecords } = analysis;

  return (
    <section className="dashboard-charts">
      <div className="dashboard-header">
        <div className="dashboard-head-content">
          <h2 className="dashboard-title">Performance Analytics</h2>
          <p className="dashboard-subtitle">Real-time battery telemetry insights</p>
        </div>
        <div className="dashboard-badge">
          <span className="badge-dot"></span>
          {allRecords.length} readings
        </div>
      </div>
      
      {/* Primary Metrics */}
      <div className="metrics-section">
        <h3 className="section-title">Key Metrics</h3>
        <div className="dashboard-metrics">
          <StatCard
            label="Voltage (V)"
            value={stats.avgVoltage}
            unit=" V"
            icon={Zap}
          />
          <StatCard
            label="Current (A)"
            value={stats.avgCurrent}
            unit=" A"
            icon={Gauge}
          />
          <StatCard
            label="Temperature (°C)"
            value={stats.avgTemp}
            unit=" °C"
            icon={Thermometer}
          />
          <StatCard
            label="Total Samples"
            value={allRecords.length}
            icon={Activity}
          />
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <h3 className="section-title">Trend Analysis</h3>
        <div className="charts-grid">
          {allRecords.length > 0 && (
            <div className="chart-panel">
              <div className="chart-header">
                <h4>Voltage Profile</h4>
                <span className="chart-stat">Range: {stats.minVoltage.toFixed(2)} - {stats.maxVoltage.toFixed(2)} V</span>
              </div>
              <LineChart
                data={allRecords}
                series={{
                  key: "voltage",
                  label: "Voltage (V)",
                  color: "#3b82f6",
                  unit: "V",
                  precision: 2
                }}
                height={240}
              />
            </div>
          )}

          {allRecords.length > 0 && (
            <div className="chart-panel">
              <div className="chart-header">
                <h4>Current Profile</h4>
                <span className="chart-stat">Range: {stats.minCurrent.toFixed(2)} - {stats.maxCurrent.toFixed(2)} A</span>
              </div>
              <LineChart
                data={allRecords}
                series={{
                  key: "current",
                  label: "Current (A)",
                  color: "#ec4899",
                  unit: "A",
                  precision: 3
                }}
                height={240}
              />
            </div>
          )}

          {allRecords.length > 0 && (
            <div className="chart-panel">
              <div className="chart-header">
                <h4>Temperature Profile</h4>
                <span className="chart-stat">Range: {stats.minTemp.toFixed(1)} - {stats.maxTemp.toFixed(1)} °C</span>
              </div>
              <LineChart
                data={allRecords}
                series={{
                  key: "temperature",
                  label: "Temperature (°C)",
                  color: "#ef4444",
                  unit: "°C",
                  precision: 1
                }}
                height={240}
              />
            </div>
          )}

          {/* Mode Distribution */}
          <div className="chart-panel distribution-panel">
            <div className="chart-header">
              <h4>Mode Distribution</h4>
              <span className="chart-stat">{allRecords.length} total</span>
            </div>
            <div className="distribution-container">
              <PieChart
                data={stats.modeDistribution}
                height={180}
                width={180}
              />
              <div className="distribution-legend">
                {Object.entries(stats.modeDistribution).map(([mode, count]) => {
                  const percentage = ((count / allRecords.length) * 100).toFixed(1);
                  const colors = {
                    CHARGE: "#3b82f6",
                    DISCHARGE: "#ec4899",
                    IDLE: "#94a3b8"
                  };
                  return (
                    <div key={mode} className="legend-row">
                      <div className="legend-info">
                        <span className="legend-dot" style={{ backgroundColor: colors[mode] }}></span>
                        <span className="legend-mode">{mode}</span>
                      </div>
                      <div className="legend-stats">
                        <span className="legend-count">{count}</span>
                        <span className="legend-pct">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Stats Section */}
      <div className="details-section">
        <h3 className="section-title">Detailed Statistics</h3>
        <div className="stats-grid">
          <div className="stat-group voltage-group">
            <div className="stat-group-header">
              <Zap size={18} />
              <h4>Voltage Statistics</h4>
            </div>
            <div className="stat-rows">
              <div className="stat-row">
                <span className="stat-name">Average</span>
                <span className="stat-value">{stats.avgVoltage.toFixed(3)} V</span>
              </div>
              <div className="stat-row">
                <span className="stat-name">Maximum</span>
                <span className="stat-value">{stats.maxVoltage.toFixed(3)} V</span>
              </div>
              <div className="stat-row">
                <span className="stat-name">Minimum</span>
                <span className="stat-value">{stats.minVoltage.toFixed(3)} V</span>
              </div>
            </div>
          </div>

          <div className="stat-group current-group">
            <div className="stat-group-header">
              <Gauge size={18} />
              <h4>Current Statistics</h4>
            </div>
            <div className="stat-rows">
              <div className="stat-row">
                <span className="stat-name">Average</span>
                <span className="stat-value">{stats.avgCurrent.toFixed(3)} A</span>
              </div>
              <div className="stat-row">
                <span className="stat-name">Maximum</span>
                <span className="stat-value">{stats.maxCurrent.toFixed(3)} A</span>
              </div>
              <div className="stat-row">
                <span className="stat-name">Minimum</span>
                <span className="stat-value">{stats.minCurrent.toFixed(3)} A</span>
              </div>
            </div>
          </div>

          <div className="stat-group temp-group">
            <div className="stat-group-header">
              <Thermometer size={18} />
              <h4>Temperature Statistics</h4>
            </div>
            <div className="stat-rows">
              <div className="stat-row">
                <span className="stat-name">Average</span>
                <span className="stat-value">{stats.avgTemp.toFixed(2)} °C</span>
              </div>
              <div className="stat-row">
                <span className="stat-name">Maximum</span>
                <span className="stat-value">{stats.maxTemp.toFixed(2)} °C</span>
              </div>
              <div className="stat-row">
                <span className="stat-name">Minimum</span>
                <span className="stat-value">{stats.minTemp.toFixed(2)} °C</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Analysis Cards */}
      {(chargeReadings.length > 0 || dischargeReadings.length > 0 || idleReadings.length > 0) && (
        <div className="modes-section">
          <h3 className="section-title">Operation Modes Breakdown</h3>
          <div className="modes-grid">
            {chargeReadings.length > 0 && (
              <div className="mode-card charge-card">
                <div className="mode-card-top">
                  <div className="mode-icon charge-icon"></div>
                  <h4>Charge Mode</h4>
                </div>
                <div className="mode-card-stat">{chargeReadings.length} readings</div>
                <div className="mode-card-details">
                  <div className="mode-detail">
                    <span>Avg Current</span>
                    <strong>{(chargeReadings.reduce((sum, r) => sum + r.current, 0) / chargeReadings.length).toFixed(3)} A</strong>
                  </div>
                  <div className="mode-detail">
                    <span>Avg Temp</span>
                    <strong>{(chargeReadings.reduce((sum, r) => sum + r.temperature, 0) / chargeReadings.length).toFixed(1)} °C</strong>
                  </div>
                </div>
              </div>
            )}

            {dischargeReadings.length > 0 && (
              <div className="mode-card discharge-card">
                <div className="mode-card-top">
                  <div className="mode-icon discharge-icon"></div>
                  <h4>Discharge Mode</h4>
                </div>
                <div className="mode-card-stat">{dischargeReadings.length} readings</div>
                <div className="mode-card-details">
                  <div className="mode-detail">
                    <span>Avg Current</span>
                    <strong>{(dischargeReadings.reduce((sum, r) => sum + r.current, 0) / dischargeReadings.length).toFixed(3)} A</strong>
                  </div>
                  <div className="mode-detail">
                    <span>Avg Temp</span>
                    <strong>{(dischargeReadings.reduce((sum, r) => sum + r.temperature, 0) / dischargeReadings.length).toFixed(1)} °C</strong>
                  </div>
                </div>
              </div>
            )}

            {idleReadings.length > 0 && (
              <div className="mode-card idle-card">
                <div className="mode-card-top">
                  <div className="mode-icon idle-icon"></div>
                  <h4>Idle Mode</h4>
                </div>
                <div className="mode-card-stat">{idleReadings.length} readings</div>
                <div className="mode-card-details">
                  <div className="mode-detail">
                    <span>Avg Current</span>
                    <strong>{(idleReadings.reduce((sum, r) => sum + r.current, 0) / idleReadings.length).toFixed(3)} A</strong>
                  </div>
                  <div className="mode-detail">
                    <span>Avg Temp</span>
                    <strong>{(idleReadings.reduce((sum, r) => sum + r.temperature, 0) / idleReadings.length).toFixed(1)} °C</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default DashboardCharts;
