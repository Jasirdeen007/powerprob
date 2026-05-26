import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart as RLineChart,
  Line,
  AreaChart as RAreaChart,
  Area,
  BarChart as RBarChart,
  Bar,
  ScatterChart as RScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from "recharts";
import { Download } from "lucide-react";
import { getMetricYDomain } from "../lib/chartDomains";
import { buildAxisLabel } from "../lib/chartEngine";
import { getChartOptionsForMetric, getDefaultChartType } from "../lib/chartOptions";
import { downloadCsv, downloadSvgChartPng, timestampForFile } from "../lib/exportUtils";

const capitalize = (s) => (typeof s === "string" && s.length ? s[0].toUpperCase() + s.slice(1) : s);

const COLORS = {
  safe: "#15915b",
  stable: "#246bfe",
  warning: "#f59e0b",
  attention: "#d97706",
  critical: "#dc2626"
};

function getStatusColor(metric, value) {
  if (metric === "temperature") {
    if (value < 30) return COLORS.stable;
    if (value < 38) return COLORS.safe;
    if (value < 42) return COLORS.warning;
    if (value < 45) return COLORS.attention;
    return COLORS.critical;
  }
  if (metric === "voltage") {
    if (value > 4.1) return COLORS.warning;
    if (value > 3.6) return COLORS.safe;
    if (value > 3.4) return COLORS.stable;
    if (value >= 3.25) return COLORS.attention;
    return COLORS.critical;
  }
  if (metric === "soc" || metric === "soh") {
    if (value > 80) return COLORS.safe;
    if (value > 50) return COLORS.stable;
    if (value > 20) return COLORS.warning;
    if (value > 10) return COLORS.attention;
    return COLORS.critical;
  }
  return COLORS.stable;
}

const TIME_SERIES_TYPES = new Set(["line", "area", "scatter", "step", "multiline"]);
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

function TelemetryChartCard({
  title,
  metricKey,
  unit,
  data,
  forceYRange,
  customAxisLabels,
  operationMode = "discharge",
  compact = false,
  showToggles = true
}) {
  const chartRef = useRef(null);
  const options = useMemo(() => getChartOptionsForMetric(metricKey), [metricKey]);
  const defaultType = useMemo(() => getDefaultChartType(metricKey), [metricKey]);
  const [activeChart, setActiveChart] = useState(defaultType);

  useEffect(() => {
    setActiveChart(getDefaultChartType(metricKey));
  }, [metricKey]);

  const processedData = useMemo(() => data.map((d) => ({
    ...d,
    time: typeof d.time === "number" ? d.time : Number(d.time) || 0
  })), [data]);
  const timeValues = useMemo(() => processedData.map((d) => d.time).filter(Number.isFinite), [processedData]);
  const minTime = timeValues.length ? Math.floor(Math.min(...timeValues)) : 0;
  const maxTime = timeValues.length ? Math.ceil(Math.max(...timeValues)) : 0;
  const timeTicks = useMemo(() => buildIntegerTicks(minTime, maxTime), [maxTime, minTime]);
  const timeSeriesWidth = Math.max(560, Math.min(4200, Math.max(processedData.length, maxTime - minTime + 1) * 12));
  const latestValue = processedData.length > 0 ? processedData.at(-1)?.[metricKey] ?? 0 : 0;
  const statusColor = getStatusColor(metricKey, latestValue);
  const isPercent = metricKey === "soc" || metricKey === "soh";
  const latestDisplay = `${latestValue.toFixed(isPercent ? 0 : 2)}${isPercent ? "%" : ` ${unit}`}`;

  const yDomain = useMemo(() => {
    if (forceYRange) return [forceYRange.min, forceYRange.max];
    const values = processedData.map((d) => d[metricKey]).filter(Number.isFinite);
    return getMetricYDomain(metricKey, values, operationMode);
  }, [forceYRange, metricKey, operationMode, processedData]);
  const formatTick = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    if (metricKey === "time") return `${Math.round(n)}`;
    if (metricKey === "soc" || metricKey === "soh") return `${Math.round(n)}`;
    if (Math.abs(n) >= 100) return Math.round(n).toString();
    return n.toFixed(1);
  };
  const formatTimeTick = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? String(Math.round(n)) : v;
  };

  function handleDownloadPng() {
    downloadSvgChartPng(chartRef.current, `${metricKey}_chart_${timestampForFile()}.png`);
  }

  function handleDownloadCsv() {
    const rows = processedData.map((row) => ({
      time_s: Math.round(row.time),
      [metricKey]: row[metricKey]
    }));
    downloadCsv(rows, ["time_s", metricKey], `${metricKey}_readings_${timestampForFile()}.csv`);
  }

  const getAxisLabel = (type) => {
    if (customAxisLabels?.[type]) return customAxisLabels[type];
    if (type === "xlabel") return buildAxisLabel("time");
    if (type === "ylabel") return buildAxisLabel(metricKey, yDomain);
    return "";
  };

  function renderRadial() {
    const remaining = Math.max(0, 100 - latestValue);
    const pieData = [
      { name: "Value", value: latestValue },
      { name: "Remaining", value: remaining }
    ];
    const inner = activeChart === "gauge" ? "72%" : "58%";
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill={statusColor} style={{ fontSize: "1.15rem", fontWeight: 700 }}>
            {`${latestValue.toFixed(0)}%`}
          </text>
          <Pie data={pieData} cx="50%" cy="50%" innerRadius={inner} outerRadius="88%" dataKey="value" stroke="none" paddingAngle={activeChart === "donut" ? 4 : 0}>
            <Cell fill={statusColor} />
            <Cell fill="var(--bg-lighter)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  function renderProgress() {
    const pct = Math.min(100, Math.max(0, latestValue));
    return (
      <div className="chart-progress-wrap">
        <div className="chart-progress-track">
          <div className="chart-progress-fill" style={{ width: `${pct}%`, backgroundColor: statusColor }} />
        </div>
        <span className="chart-progress-label" style={{ color: statusColor }}>{pct.toFixed(1)}%</span>
      </div>
    );
  }

  function renderTimeSeries() {
    const chartContent = (() => {
      switch (activeChart) {
        case "bar":
          return <Bar dataKey={metricKey} fill={statusColor} radius={[2, 2, 0, 0]} isAnimationActive={false} />;
        case "area":
          return (
            <>
              <defs>
                <linearGradient id={`gradient-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={statusColor} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={statusColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey={metricKey} stroke={statusColor} fill={`url(#gradient-${metricKey})`} isAnimationActive={false} />
            </>
          );
        case "scatter":
          return <Scatter dataKey={metricKey} fill={statusColor} isAnimationActive={false} />;
        case "step":
          return <Line type="stepAfter" dataKey={metricKey} stroke={statusColor} dot={false} strokeWidth={2} isAnimationActive={false} />;
        case "line":
        default:
          return <Line type="monotone" dataKey={metricKey} stroke={statusColor} dot={false} strokeWidth={2} activeDot={{ r: 4 }} isAnimationActive={false} />;
      }
    })();

    const ChartComponent = activeChart === "bar"
      ? RBarChart
      : activeChart === "area"
        ? RAreaChart
        : activeChart === "scatter"
          ? RScatterChart
          : RLineChart;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={processedData} margin={{ top: 8, right: 16, left: 0, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            domain={[minTime, maxTime]}
            ticks={timeTicks}
            interval={0}
            tickFormatter={formatTimeTick}
            tick={{ fill: "var(--text-main)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            label={{ value: getAxisLabel("xlabel"), position: "insideBottom", offset: -8, fill: "var(--text-muted)", fontSize: 10 }}
          />
          <YAxis
            domain={yDomain}
            width={0}
            tick={false}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={false}
            formatter={(value) => [Number(value).toFixed(2), title]}
            contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-main)", borderRadius: "6px", color: "var(--text-main)" }}
            labelStyle={{ color: "var(--text-muted)" }}
            itemStyle={{ color: statusColor, fontWeight: 700 }}
          />
          {chartContent}
        </ChartComponent>
      </ResponsiveContainer>
    );
  }

  function renderChart() {
    if (processedData.length === 0) return null;
    if (activeChart === "progress" && isPercent) return renderProgress();
    if (activeChart === "gauge" || activeChart === "donut") return renderRadial();
    if (TIME_SERIES_TYPES.has(activeChart)) return renderTimeSeries();
    return renderTimeSeries();
  }

  const isTimeSeries = TIME_SERIES_TYPES.has(activeChart) && processedData.length > 0;

  return (
    <div className={`telemetry-chart-card panel ${compact ? "compact" : ""}`}>
      <div className="panel-head telemetry-chart-head">
        <div>
          <h3 className="telemetry-chart-title">{capitalize(title)}</h3>
          <div className="telemetry-chart-meta">
            <span className="telemetry-chart-range">{buildAxisLabel(metricKey, yDomain)}</span>
            <span className="telemetry-chart-value" style={{ color: statusColor }} title={latestDisplay}>
              {latestValue.toFixed(isPercent ? 0 : 2)}{isPercent ? "%" : ` ${unit}`}
            </span>
          </div>
        </div>
        <div className="chart-card-actions">
          {showToggles && options.length > 1 ? (
            <div className="visual-toggle" aria-label="Chart type">
              {options.map(({ key, Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  className={activeChart === key ? "active" : ""}
                  onClick={() => setActiveChart(key)}
                  title={label}
                  style={{ color: activeChart === key ? statusColor : "var(--text-light)" }}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          ) : null}
          <div className="chart-download-actions" aria-label={`${title} downloads`}>
            <button type="button" onClick={handleDownloadPng} title="Download chart PNG">
              <Download size={14} /> PNG
            </button>
            <button type="button" onClick={handleDownloadCsv} title="Download chart CSV">
              CSV
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative", width: "100%", overflow: "hidden" }}>
        {/* Static Left Y-Axis Container */}
        {isTimeSeries && (
          <div style={{ width: "58px", flexShrink: 0, height: "100%", pointerEvents: "none" }}>
            <ResponsiveContainer width="100%" height="100%">
              <RLineChart data={processedData} margin={{ top: 8, right: 0, left: 12, bottom: 28 }}>
                <XAxis hide dataKey="time" type="number" domain={[minTime, maxTime]} />
                <YAxis
                  domain={yDomain}
                  tickFormatter={formatTick}
                  tick={{ fill: "var(--text-main)", fontSize: 10 }}
                  tickLine={{ stroke: "var(--border-strong)" }}
                  axisLine={{ stroke: "var(--border-strong)" }}
                  width={46}
                  label={{
                    value: getAxisLabel("ylabel"),
                    angle: -90,
                    position: "insideLeft",
                    offset: -2,
                    fill: "var(--text-muted)",
                    fontSize: 10
                  }}
                />
                <Line type="monotone" dataKey={metricKey} stroke="transparent" dot={false} isAnimationActive={false} />
              </RLineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Scrollable Main Chart Area */}
        <div className="chart-scroll" style={{ flex: 1, minWidth: 0, height: "100%" }}>
          <div className="chart-container" ref={chartRef} style={{ minWidth: isTimeSeries ? `${timeSeriesWidth}px` : undefined, height: "100%" }}>
            {renderChart()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(TelemetryChartCard);
