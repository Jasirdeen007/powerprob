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
  CartesianGrid
} from "recharts";
import { memo, useEffect, useMemo, useRef } from "react";
import { Download } from "lucide-react";
import { getCustomYDomain } from "../lib/chartDomains";
import { buildAxisLabel, VARIABLES } from "../lib/chartEngine";
import {
  AXIS_X_PROPS,
  AXIS_Y_PROPS,
  buildAlignedDualTicks,
  CUSTOM_CHART_MARGIN,
  CUSTOM_CHART_MARGIN_DUAL_RIGHT,
  CUSTOM_Y_AXIS_OVERLAY_MARGIN,
  CUSTOM_Y_AXIS_OVERLAY_MARGIN_RIGHT,
  formatGenericValueTick,
  formatTimeTick,
  getEvenTicksWithDomain,
  getTimeAxisExtent,
  scrollChartToEnd,
  SERIES_CLIP_PROPS,
  toYDomain,
  xAxisLabelProps,
  xAxisPlaceholderProps,
  Y_AXIS_OVERLAY_WIDTH,
  Y_AXIS_TICK_STYLE,
  Y_AXIS_WIDTH
} from "../lib/chartTicks";
import { downloadCsv, downloadSvgChartPng, timestampForFile } from "../lib/exportUtils";

const SERIES_COLORS = { y1: "#246bfe", y2: "#15915b" };

function CustomChartTooltip({ active, payload, label, xIsTime }) {
  if (!active || !payload?.length) return null;

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
      <p style={{ margin: "0 0 6px", color: "var(--text-muted)" }}>
        {xIsTime ? `Time: ${formatTimeTick(label)} s` : `X: ${formatGenericValueTick(label)}`}
      </p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ margin: "2px 0", fontWeight: 700, color: entry.color }}>
          {entry.name}: {Number(entry.value).toFixed(2)}
        </p>
      ))}
    </div>
  );
}

function CustomChartPanel({ config, data, operationMode = "discharge" }) {
  if (!config) {
    return (
      <div className="custom-chart-empty panel">
        <p>Select axes and apply to view a live custom chart.</p>
      </div>
    );
  }

  return <RenderedCustomChart config={config} data={data ?? []} operationMode={operationMode} />;
}

function RenderedCustomChart({ config, data, operationMode }) {
  const chartRef = useRef(null);
  const scrollRef = useRef(null);

  const processed = useMemo(() => data.map((row) => ({
    ...row,
    [config.x]: typeof row[config.x] === "number" ? row[config.x] : Number(row[config.x]) || 0,
    [config.y1]: Number(row[config.y1]) || 0,
    ...(config.y2 ? { [config.y2]: Number(row[config.y2]) || 0 } : {})
  })), [config, data]);

  const y1Domain = toYDomain(getCustomYDomain(config.y1, [], operationMode));
  const y2Domain = config.y2 ? toYDomain(getCustomYDomain(config.y2, [], operationMode)) : null;

  const xValues = processed.map((r) => r[config.x]).filter(Number.isFinite);
  const xIsTime = config.x === "time";
  const timeAxis = useMemo(
    () => (xIsTime ? getTimeAxisExtent(xValues) : null),
    [xIsTime, xValues]
  );

  const xDomain = xIsTime
    ? timeAxis.domain
    : getCustomYDomain(config.x, xValues, operationMode);
  const xTicks = xIsTime ? timeAxis.ticks : getEvenTicksWithDomain(xDomain[0], xDomain[1], 6).ticks;
  const chartWidth = xIsTime ? timeAxis.scrollWidth : 760;

  const useDual = config.y2 && config.chart === "multi_line" && config.dual_axis;
  const alignedTicks = useDual && y2Domain
    ? buildAlignedDualTicks(y1Domain, y2Domain)
    : null;
  const y1TickInfo = useMemo(
    () => (alignedTicks ? { ticks: alignedTicks.leftTicks, domain: alignedTicks.leftDomain } : getEvenTicksWithDomain(y1Domain[0], y1Domain[1], 6)),
    [alignedTicks, y1Domain]
  );
  const y2TickInfo = useMemo(
    () => {
      if (!y2Domain) return null;
      if (alignedTicks) return { ticks: alignedTicks.rightTicks, domain: alignedTicks.rightDomain };
      return getEvenTicksWithDomain(y2Domain[0], y2Domain[1], 6);
    },
    [alignedTicks, y2Domain]
  );
  const y1Ticks = y1TickInfo.ticks;
  const y2Ticks = y2TickInfo?.ticks ?? null;
  const y1DomainAligned = y1TickInfo.domain;
  const y2DomainAligned = y2TickInfo?.domain ?? null;

  const xLabelBase = buildAxisLabel(config.x, xIsTime ? null : xDomain);
  const xLabel = xLabelBase;
  const y1Label = buildAxisLabel(config.y1, y1Domain);
  const y2Label = config.y2 ? buildAxisLabel(config.y2, y2Domain) : null;

  const xAxisProps = {
    ...AXIS_X_PROPS,
    // Ensure domain starts at 0 when possible so tick "0" aligns with Y axis
    domain: xDomain ? [Math.min(0, xDomain[0] ?? 0), xDomain[1] ?? xDomain[0]] : xDomain,
    ticks: xTicks,
    interval: 0
  };

  const scrollMargin = useDual ? CUSTOM_CHART_MARGIN_DUAL_RIGHT : CUSTOM_CHART_MARGIN;
  const yOverlayMargin = CUSTOM_Y_AXIS_OVERLAY_MARGIN;
  const yOverlayMarginRight = CUSTOM_Y_AXIS_OVERLAY_MARGIN_RIGHT;

  useEffect(() => {
    if (!xIsTime) return;
    scrollChartToEnd(scrollRef.current);
  }, [xDomain?.[1], processed.length, xIsTime, chartWidth]);

  function renderSeries() {
    if (config.chart === "scatter") {
      return <Scatter dataKey={config.y1} name={VARIABLES_LABEL(config.y1)} fill={SERIES_COLORS.y1} yAxisId="left" {...SERIES_CLIP_PROPS} />;
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
          <Area type="monotone" dataKey={config.y1} stroke={SERIES_COLORS.y1} fill="url(#custom-area-gradient)" yAxisId="left" baseValue={y1Domain[0]} {...SERIES_CLIP_PROPS} />
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
            {...SERIES_CLIP_PROPS}
          />
          <Line
            type="monotone"
            dataKey={config.y2}
            name={VARIABLES_LABEL(config.y2)}
            stroke={SERIES_COLORS.y2}
            dot={false}
            strokeWidth={2}
            yAxisId={useDual ? "right" : "left"}
            {...SERIES_CLIP_PROPS}
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
        {...SERIES_CLIP_PROPS}
      />
    );
  }

  const ChartType = config.chart === "scatter" ? ScatterChart : config.chart === "area" ? AreaChart : LineChart;

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

      <div className="chart-plot-area" style={{ height: "320px", marginTop: "10px" }}>
        <div className="custom-chart-scroll chart-scroll" ref={scrollRef}>
          <div className="custom-chart-canvas" ref={chartRef} style={{ minWidth: `${chartWidth}px`, height: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ChartType data={processed} margin={scrollMargin}>
                <CartesianGrid clipPath="none" strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey={config.x}
                  {...xAxisProps}
                    padding={{ left: 0, right: 0 }}
                    allowDataOverflow={false}
                  tickFormatter={xIsTime ? formatTimeTick : formatGenericValueTick}
                  tick={{ fill: "var(--text-main)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  label={xAxisLabelProps(xLabel)}
                />
                <YAxis
                  yAxisId="left"
                  {...AXIS_Y_PROPS}
                  domain={y1DomainAligned}
                  ticks={y1Ticks}
                  width={0}
                  tick={false}
                  axisLine={false}
                  tickLine={false}
                />
                {useDual ? (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    {...AXIS_Y_PROPS}
                    domain={y2DomainAligned}
                    ticks={y2Ticks}
                    width={0}
                    tick={false}
                    axisLine={false}
                    tickLine={false}
                  />
                ) : null}
                <Tooltip
                  cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                  content={<CustomChartTooltip xIsTime={xIsTime} />}
                />
                {renderSeries()}
              </ChartType>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-y-axis-overlay" style={{ width: Y_AXIS_OVERLAY_WIDTH }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={processed} margin={yOverlayMargin}>
              <XAxis {...xAxisPlaceholderProps(config.x, xDomain)} />
              <YAxis
                yAxisId="left"
                {...AXIS_Y_PROPS}
                domain={y1DomainAligned}
                ticks={y1Ticks}
                tickFormatter={formatGenericValueTick}
                tick={Y_AXIS_TICK_STYLE}
                tickLine={{ stroke: "var(--border-strong)" }}
                axisLine={{ stroke: "var(--border-strong)" }}
                width={Y_AXIS_WIDTH}
                allowDecimals
                tickMargin={4}
              />
              <Line yAxisId="left" type="monotone" dataKey={config.y1} stroke="transparent" dot={false} {...SERIES_CLIP_PROPS} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {useDual ? (
          <div className="chart-y-axis-overlay-right" style={{ width: Y_AXIS_OVERLAY_WIDTH }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={processed} margin={yOverlayMarginRight}>
                <XAxis {...xAxisPlaceholderProps(config.x, xDomain)} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  {...AXIS_Y_PROPS}
                  domain={y2DomainAligned}
                  ticks={y2Ticks}
                  tickFormatter={formatGenericValueTick}
                  tick={Y_AXIS_TICK_STYLE}
                  tickLine={{ stroke: "var(--border-strong)" }}
                  axisLine={{ stroke: "var(--border-strong)" }}
                  width={Y_AXIS_WIDTH}
                  allowDecimals
                  tickMargin={4}
                />
                <Line yAxisId="right" type="monotone" dataKey={config.y2} stroke="transparent" dot={false} {...SERIES_CLIP_PROPS} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default memo(CustomChartPanel);

function VARIABLES_LABEL(key) {
  return VARIABLES[key]?.label ?? key;
}
