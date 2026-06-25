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
import { BarChart3, Download } from "lucide-react";
import { getDynamicMetricYDomain } from "../lib/chartDomains";
import { buildAxisLabel } from "../lib/chartEngine";
import { getChartOptionsForMetric, getDefaultChartType } from "../lib/chartOptions";
import {
  AXIS_X_PROPS,
  AXIS_Y_PROPS,
  CHART_MARGIN,
  formatTimeTick,
  formatValueTick,
  getEvenTicksWithDomain,
  getTimeAxisExtent,
  isScrolledNearTime,
  scrollChartToTime,
  SERIES_CLIP_PROPS,
  toYDomain,
  xAxisLabelProps,
  xAxisPlaceholderProps,
  Y_AXIS_OVERLAY_MARGIN,
  Y_AXIS_OVERLAY_WIDTH,
  Y_AXIS_TICK_STYLE,
  Y_AXIS_WIDTH
} from "../lib/chartTicks";
import { downloadCsv, downloadMetricCardPng, timestampForFile } from "../lib/exportUtils";

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
    if (value < 0) return "#60a5fa";
    if (value < 10) return COLORS.warning;
    if (value < 45) return COLORS.safe;
    if (value < 50) return COLORS.stable;
    if (value < 55) return COLORS.warning;
    if (value < 60) return COLORS.attention;
    return COLORS.critical;
  }
  if (metric === "voltage") {
    if (value > 4.2) return COLORS.warning;
    if (value >= 3.7) return COLORS.safe;
    if (value >= 3.5) return COLORS.warning;
    if (value >= 3.2) return COLORS.critical;
    return COLORS.critical;
  }
  if (metric === "soc" || metric === "soh") {
    if (metric === "soc") {
      if (value > 25) return COLORS.safe;
      if (value > 15) return COLORS.warning;
      if (value > 10) return COLORS.attention;
      return COLORS.critical;
    }
    if (value > 80) return COLORS.safe;
    if (value > 70) return COLORS.warning;
    if (value > 50) return COLORS.attention;
    return COLORS.critical;
  }
  return COLORS.stable;
}

const TIME_SERIES_TYPES = new Set(["line", "area", "scatter", "step", "multiline"]);

function hasMeaningfulTelemetry(data, metricKey) {
  return data.some((reading) => {
    if (reading?.timestamp) return true;
    return [reading?.[metricKey], reading?.voltage, reading?.current, reading?.temperature].some((value) => Number(value) !== 0);
  });
}

function TimeSeriesTooltip({ active, payload, label, title, unit, isPercent }) {
  if (!active || !payload?.length) return null;
  const timeLabel = formatTimeTick(label);
  const value = payload[0]?.value;
  const formatted = Number.isFinite(Number(value))
    ? `${Number(value).toFixed(isPercent ? 0 : 2)}${isPercent ? "%" : ` ${unit}`}`
    : "—";

  return (
    <div
      className="chart-tooltip"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-main)",
        borderRadius: "6px",
        padding: "8px 10px",
        color: "var(--text-main)",
        fontSize: "0.75rem"
      }}
    >
      <p style={{ margin: "0 0 4px", color: "var(--text-muted)" }}>Time: {timeLabel} s</p>
      <p style={{ margin: 0, fontWeight: 700, color: payload[0]?.color ?? "var(--text-main)" }}>
        {title}: {formatted}
      </p>
    </div>
  );
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
  showToggles = true,
  autoFollowLatest = true,
  controlledChartType,
  onSelectChart,
  focused = false
}) {
  const chartRef = useRef(null);
  const cardRef = useRef(null);
  const scrollRef = useRef(null);
  const followLatestRef = useRef(true);
  const hadActiveDataRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const scrollReleaseTimerRef = useRef(null);
  const options = useMemo(() => getChartOptionsForMetric(metricKey), [metricKey]);
  const defaultType = useMemo(() => getDefaultChartType(metricKey), [metricKey]);
  const [activeChart, setActiveChart] = useState(defaultType);
  const [isInitialAnimation, setIsInitialAnimation] = useState(true);

  useEffect(() => {
    setActiveChart(getDefaultChartType(metricKey));
  }, [metricKey]);

  useEffect(() => {
    if (controlledChartType) {
      setActiveChart(String(controlledChartType).split(":")[0]);
    }
  }, [controlledChartType]);



  const processedData = useMemo(() => {
    const mappedData = data.map((d) => ({
      ...d,
      time: typeof d.time === "number" ? d.time : Number(d.time) || 0
    }));

    if (mappedData.length > 2000) {
      const every = Math.ceil(mappedData.length / 1000);
      return mappedData.filter((_, i) => i % every === 0);
    }
    return mappedData;
  }, [data]);

  useEffect(() => {
    if (processedData.length > 0) {
      const timer = setTimeout(() => setIsInitialAnimation(false), 50);
      return () => clearTimeout(timer);
    } else {
      setIsInitialAnimation(true);
    }
  }, [processedData.length]);
  
  const hasActiveData = useMemo(() => hasMeaningfulTelemetry(processedData, metricKey), [metricKey, processedData]);

  const timeValues = useMemo(() => processedData.map((d) => d.time).filter(Number.isFinite), [processedData]);
  const timeAxis = useMemo(() => getTimeAxisExtent(timeValues), [timeValues]);
  const [domainMin, domainMax] = timeAxis.domain;
  const timeTicks = timeAxis.ticks;
  const timeSeriesWidth = timeAxis.scrollWidth;

  const latestValue = processedData.length > 0 ? processedData.at(-1)?.[metricKey] ?? 0 : 0;
  const latestTime = processedData.length > 0 ? processedData.at(-1)?.time ?? 0 : 0;
  const statusColor = getStatusColor(metricKey, latestValue);
  const isPercent = metricKey === "soc" || metricKey === "soh";
  const latestDisplay = `${latestValue.toFixed(isPercent ? 0 : 2)}${isPercent ? "%" : ` ${unit}`}`;

  const yDomain = useMemo(() => {
    if (forceYRange) return [forceYRange.min, forceYRange.max];
    return getDynamicMetricYDomain(metricKey, processedData.map((row) => row[metricKey]), operationMode);
  }, [forceYRange, metricKey, operationMode, processedData]);

  const yDomainStrict = useMemo(() => toYDomain(yDomain), [yDomain]);
  const yTickInfo = useMemo(
    () => getEvenTicksWithDomain(yDomainStrict[0], yDomainStrict[1], 6),
    [yDomainStrict]
  );
  const yTicks = yTickInfo.ticks;
  const yDomainAligned = yTickInfo.domain;

  const formatTick = (v) => formatValueTick(metricKey, v);

  function pinChartToLatest() {
    programmaticScrollRef.current = true;
    if (scrollReleaseTimerRef.current) {
      window.clearTimeout(scrollReleaseTimerRef.current);
    }

    const scrollNow = () => scrollChartToTime(scrollRef.current, latestTime, "auto");
    scrollNow();
    requestAnimationFrame(() => {
      scrollNow();
      requestAnimationFrame(scrollNow);
    });

    scrollReleaseTimerRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 180);
  }

  useEffect(() => {
    if (!autoFollowLatest) {
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;
      followLatestRef.current = false;
      return;
    }

    if (!hasActiveData) {
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;
      followLatestRef.current = false;
      hadActiveDataRef.current = false;
      return;
    }

    if (!hadActiveDataRef.current) {
      hadActiveDataRef.current = true;
      followLatestRef.current = true;
      pinChartToLatest();
      return;
    }

    if (followLatestRef.current) {
      pinChartToLatest();
    }
  }, [autoFollowLatest, domainMax, hasActiveData, latestTime, processedData.length, timeSeriesWidth]);

  useEffect(() => () => {
    if (scrollReleaseTimerRef.current) {
      window.clearTimeout(scrollReleaseTimerRef.current);
    }
  }, []);

  function handleChartScroll(event) {
    if (programmaticScrollRef.current) return;
    followLatestRef.current = autoFollowLatest && hasActiveData && isScrolledNearTime(event.currentTarget, latestTime);
  }

  function handleDownloadPng() {
    downloadMetricCardPng(cardRef.current, `${metricKey}_card_${timestampForFile()}.png`);
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
          return <Bar dataKey={metricKey} fill={statusColor} radius={[2, 2, 0, 0]} baseValue={yDomainStrict[0]} {...SERIES_CLIP_PROPS} />;
        case "area":
          return (
            <>
              <defs>
                <linearGradient id={`gradient-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={statusColor} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={statusColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey={metricKey} stroke={statusColor} fill={`url(#gradient-${metricKey})`} baseValue={yDomainStrict[0]} {...SERIES_CLIP_PROPS} />
            </>
          );
        case "scatter":
          return <Scatter dataKey={metricKey} fill={statusColor} {...SERIES_CLIP_PROPS} />;
        case "step":
          return <Line type="stepAfter" dataKey={metricKey} stroke={statusColor} dot={false} strokeWidth={2} {...SERIES_CLIP_PROPS} />;
        case "line":
        default:
          return <Line type="monotone" dataKey={metricKey} stroke={statusColor} dot={false} strokeWidth={2} activeDot={{ r: 4 }} {...SERIES_CLIP_PROPS} />;
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
        <ChartComponent data={processedData} margin={CHART_MARGIN} isAnimationActive={!isInitialAnimation}>
          <CartesianGrid clipPath="none" strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="time"
            {...AXIS_X_PROPS}
            // Prefer starting axis at zero so the (0,0) origin is flush with Y axis
            domain={[Math.min(0, domainMin ?? 0), domainMax]}
            ticks={timeTicks}
            interval={0}
            tickFormatter={formatTimeTick}
            tick={{ fill: "var(--text-main)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            label={xAxisLabelProps(getAxisLabel("xlabel"))}
            padding={{ left: 0, right: 0 }}
            allowDataOverflow={false}
          />
          <YAxis
            {...AXIS_Y_PROPS}
            domain={yDomainAligned}
            ticks={yTicks}
            width={0}
            tick={false}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={(
              <TimeSeriesTooltip
                title={capitalize(title)}
                unit={unit}
                isPercent={isPercent}
              />
            )}
          />
          {chartContent}
        </ChartComponent>
      </ResponsiveContainer>
    );
  }

  function renderChart() {
    if (activeChart === "progress" && isPercent) {
      return processedData.length > 0 ? renderProgress() : renderTimeSeries();
    }
    if (activeChart === "gauge" || activeChart === "donut") {
      return processedData.length > 0 ? renderRadial() : renderTimeSeries();
    }
    if (TIME_SERIES_TYPES.has(activeChart)) return renderTimeSeries();
    return renderTimeSeries();
  }

  const isTimeSeries = TIME_SERIES_TYPES.has(activeChart)
    || (activeChart === "progress" && isPercent && processedData.length === 0)
    || ((activeChart === "gauge" || activeChart === "donut") && processedData.length === 0);

  return (
    <div
      className={`telemetry-chart-card panel ${compact ? "compact" : ""} ${focused ? "focused" : ""}`}
      ref={cardRef}
      style={{ minWidth: 0 }}
      onClick={(event) => {
        if (!onSelectChart) return;
        if (event.target.closest("button, a, input, select, textarea")) return;
        onSelectChart(metricKey);
      }}
      role={onSelectChart ? "button" : undefined}
      tabIndex={onSelectChart ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onSelectChart) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectChart(metricKey);
        }
      }}
    >
      <div className="panel-head telemetry-chart-head">
        <div>
          <h3 className="telemetry-chart-title">{capitalize(title)}</h3>
          <div className="telemetry-chart-meta">
            <span className="telemetry-chart-icon"><BarChart3 size={13} /></span>
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
      <div className="chart-plot-area">
        <div className="chart-scroll" ref={scrollRef} onScroll={handleChartScroll}>
          <div
            className="chart-container"
            ref={chartRef}
            style={{ minWidth: isTimeSeries ? `${timeSeriesWidth}px` : undefined, height: "100%" }}
          >
            {renderChart()}
          </div>
        </div>

        {isTimeSeries ? (
          <div className="chart-y-axis-overlay" style={{ width: Y_AXIS_OVERLAY_WIDTH }}>
            <ResponsiveContainer width="100%" height="100%">
              <RLineChart data={processedData} margin={Y_AXIS_OVERLAY_MARGIN}>
                <XAxis {...xAxisPlaceholderProps("time", [domainMin, domainMax])} />
                <YAxis
                  {...AXIS_Y_PROPS}
                  domain={yDomainAligned}
                  ticks={yTicks}
                  tickFormatter={formatTick}
                  tick={Y_AXIS_TICK_STYLE}
                  tickLine={{ stroke: "var(--border-strong)" }}
                  axisLine={{ stroke: "var(--border-strong)" }}
                  width={Y_AXIS_WIDTH}
                  allowDecimals
                  tickMargin={4}
                />
                <Line type="monotone" dataKey={metricKey} stroke="transparent" dot={false} {...SERIES_CLIP_PROPS} />
              </RLineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default memo(TelemetryChartCard);
