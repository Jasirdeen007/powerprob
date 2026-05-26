import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from "recharts";
import { memo, useMemo, useRef } from "react";
import { Download } from "lucide-react";
import { getCustomYDomain } from "../lib/chartDomains";
import { buildAxisLabel } from "../lib/chartEngine";
import { downloadCsv, downloadSvgChartPng, timestampForFile } from "../lib/exportUtils";

const SERIES_COLORS = { y1: "#246bfe", y2: "#15915b" };
const MAX_RENDERED_TIME_TICKS = 24;

function buildIntegerTicks(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [0];
  const range = Math.max(1, max - min);
  const step = Math.max(1, Math.ceil(range / MAX_RENDERED_TIME_TICKS));
  const ticks = [];
  for (let value = min; value <= max; value += step) {
    ticks.push(value);
  }
  if (ticks.at(-1) !== max) ticks.push(max);
  return ticks;
}

function formatTick(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (Math.abs(n) >= 100) return Math.round(n).toString();
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function CustomChartPanel({ config, data, operationMode = "discharge" }) {
  if (!config || data.length === 0) {
    return (
      <div className="custom-chart-empty panel">
        <p>Select axes and apply to view a live custom chart.</p>
      </div>
    );
  }

  return <RenderedCustomChart config={config} data={data} operationMode={operationMode} />;
}

function RenderedCustomChart({ config, data, operationMode }) {
  const chartRef = useRef(null);

  const processed = useMemo(() => data.map((row) => ({
    ...row,
    [config.x]: typeof row[config.x] === "number" ? row[config.x] : Number(row[config.x]) || 0,
    [config.y1]: Number(row[config.y1]) || 0,
    ...(config.y2 ? { [config.y2]: Number(row[config.y2]) || 0 } : {})
  })), [config, data]);

  const y1Values = processed.map((r) => r[config.y1]);
  const y2Values = config.y2 ? processed.map((r) => r[config.y2]) : [];
  const xValues = processed.map((r) => r[config.x]);

  const y1Domain = getCustomYDomain(config.y1, y1Values, operationMode);
  const y2Domain = config.y2 ? getCustomYDomain(config.y2, y2Values, operationMode) : null;
  const xDomain = config.x === "time" ? ["auto", "auto"] : getCustomYDomain(config.x, xValues, operationMode);

  const xLabelBase = buildAxisLabel(config.x, config.x === "time" ? null : xDomain);
  const xLabel = config.x === "time" ? `${xLabelBase} (s)` : xLabelBase;
  const y1Label = buildAxisLabel(config.y1, y1Domain);
  const y2Label = config.y2 ? buildAxisLabel(config.y2, y2Domain) : null;

  const useDual = config.y2 && config.chart === "multi_line" && config.dual_axis;
  const xIsTime = config.x === "time";
  const minTime = xIsTime && xValues.length ? Math.floor(Math.min(...xValues)) : 0;
  const maxTime = xIsTime && xValues.length ? Math.ceil(Math.max(...xValues)) : 0;
  const timeTicks = useMemo(() => xIsTime ? buildIntegerTicks(minTime, maxTime) : undefined, [maxTime, minTime, xIsTime]);
  const chartWidth = xIsTime ? Math.max(680, Math.min(4200, Math.max(processed.length, maxTime - minTime + 1) * 12)) : 760;
  const chartMargin = {
    top: 16,
    right: useDual ? 52 : 20,
    left: 56,
    bottom: config.y2 ? 36 : 28
  };

  function renderSeries() {
    if (config.chart === "scatter") {
      return <Scatter dataKey={config.y1} name={VARIABLES_LABEL(config.y1)} fill={SERIES_COLORS.y1} yAxisId="left" isAnimationActive={false} />;
    }

    if (config.chart === "area") {
      return (
        <>
          <defs>
            <linearGradient id="custom-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SERIES_COLORS.y1} stopOpacity={0.75} />
              <stop offset="95%" stopColor={SERIES_COLORS.y1} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={config.y1} stroke={SERIES_COLORS.y1} fill="url(#custom-area-gradient)" yAxisId="left" isAnimationActive={false} />
        </>
      );
    }

    if (config.chart === "multi_line" && config.y2) {
      return (
        <>
          <Line
            type="monotone"
            dataKey={config.y1}
            name={VARIABLES_LABEL(config.y1)}
            stroke={SERIES_COLORS.y1}
            dot={false}
            strokeWidth={2}
            yAxisId="left"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey={config.y2}
            name={VARIABLES_LABEL(config.y2)}
            stroke={SERIES_COLORS.y2}
            dot={false}
            strokeWidth={2}
            yAxisId={useDual ? "right" : "left"}
            isAnimationActive={false}
          />
        </>
      );
    }

    return (
      <Line
        type="monotone"
        dataKey={config.y1}
        stroke={SERIES_COLORS.y1}
        dot={false}
        strokeWidth={2}
        yAxisId="left"
        isAnimationActive={false}
      />
    );
  }

  const ChartType = config.chart === "scatter" ? ScatterChart : config.chart === "area" ? AreaChart : LineChart;
  const xAxisProps = xIsTime
    ? { type: "number", domain: [minTime, maxTime], ticks: timeTicks, interval: 0 }
    : { type: "number", domain: xDomain };

  function handleDownloadPng() {
    downloadSvgChartPng(chartRef.current, `custom_chart_${timestampForFile()}.png`);
  }

  function handleDownloadCsv() {
    const columns = [config.x, config.y1, ...(config.y2 ? [config.y2] : [])];
    const rows = processed.map((row) => Object.fromEntries(columns.map((key) => [
      key === "time" ? "time_s" : key,
      key === "time" ? Math.round(row[key]) : row[key]
    ])));
    const exportColumns = columns.map((key) => (key === "time" ? "time_s" : key));
    downloadCsv(rows, exportColumns, `custom_chart_${timestampForFile()}.csv`);
  }

  const mainChartMargin = {
    top: 16,
    right: 20,
    left: 0,
    bottom: config.y2 ? 36 : 28
  };

  return (
    <div className="custom-chart-panel panel">
      <div className="custom-chart-panel-head">
        <div>
          <h3>{config.title}</h3>
          <div className="custom-chart-legend-row">
            <span className="custom-legend-item">X: {xLabel}</span>
            <span className="custom-legend-item" style={{ color: SERIES_COLORS.y1 }}>Y: {y1Label}</span>
            {config.y2 ? (
              <span className="custom-legend-item" style={{ color: SERIES_COLORS.y2 }}>Y2: {y2Label}</span>
            ) : null}
          </div>
        </div>
        <div className="chart-download-actions">
          <button type="button" onClick={handleDownloadPng} title="Download chart PNG">
            <Download size={14} /> PNG
          </button>
          <button type="button" onClick={handleDownloadCsv} title="Download chart CSV">
            CSV
          </button>
        </div>
      </div>
      {config.warning ? <p className="custom-chart-warning">{config.warning}</p> : null}
      
      <div style={{ display: "flex", width: "100%", height: "320px", marginTop: "10px", position: "relative", overflow: "hidden" }}>
        {/* Left Static Y-Axis Container */}
        <div style={{ width: "56px", flexShrink: 0, height: "100%", pointerEvents: "none" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={processed} margin={{ top: 16, right: 0, left: 12, bottom: config.y2 ? 36 : 28 }}>
              <XAxis hide dataKey={config.x} {...xAxisProps} />
              <YAxis
                yAxisId="left"
                domain={y1Domain}
                tickFormatter={formatTick}
                tick={{ fill: "var(--text-main)", fontSize: 10 }}
                tickLine={{ stroke: "var(--border-strong)" }}
                axisLine={{ stroke: "var(--border-strong)" }}
                width={44}
              />
              <Line yAxisId="left" type="monotone" dataKey={config.y1} stroke="transparent" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Scrollable Main Chart Area */}
        <div className="custom-chart-scroll" style={{ flex: 1, minWidth: 0, height: "100%" }}>
          <div className="custom-chart-canvas" ref={chartRef} style={{ minWidth: `${chartWidth}px`, height: "100%", marginTop: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ChartType data={processed} margin={mainChartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey={config.x}
                  {...xAxisProps}
                  tickFormatter={xIsTime ? (value) => String(Math.round(Number(value))) : formatTick}
                  tick={{ fill: "var(--text-main)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  label={{ value: xLabel, position: "insideBottom", offset: -4, fill: "var(--text-muted)", fontSize: 10 }}
                />
                <YAxis
                  yAxisId="left"
                  domain={y1Domain}
                  width={0}
                  tick={false}
                  axisLine={false}
                  tickLine={false}
                />
                {useDual ? (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={y2Domain}
                    width={0}
                    tick={false}
                    axisLine={false}
                    tickLine={false}
                  />
                ) : null}
                <Tooltip
                  formatter={(value, name) => [Number(value).toFixed(2), name]}
                  contentStyle={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-main)",
                    borderRadius: "6px",
                    color: "var(--text-main)"
                  }}
                />
                {config.y2 ? (
                  <Legend
                    verticalAlign="bottom"
                    height={24}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                ) : null}
                {renderSeries()}
              </ChartType>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Static Y-Axis Container */}
        {useDual && (
          <div style={{ width: "56px", flexShrink: 0, height: "100%", pointerEvents: "none" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={processed} margin={{ top: 16, right: 12, left: 0, bottom: config.y2 ? 36 : 28 }}>
                <XAxis hide dataKey={config.x} {...xAxisProps} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={y2Domain}
                  tickFormatter={formatTick}
                  tick={{ fill: "var(--text-main)", fontSize: 10 }}
                  tickLine={{ stroke: "var(--border-strong)" }}
                  axisLine={{ stroke: "var(--border-strong)" }}
                  width={44}
                />
                <Line yAxisId="right" type="monotone" dataKey={config.y2} stroke="transparent" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(CustomChartPanel);

function VARIABLES_LABEL(key) {
  const labels = {
    voltage: "Voltage",
    current: "Current",
    temperature: "Temp",
    soc: "SOC",
    soh: "SOH",
    power: "Power",
    time: "Time"
  };
  return labels[key] ?? key;
}
