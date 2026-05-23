import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from "recharts";
import { getCustomYDomain } from "../lib/chartDomains";
import { buildAxisLabel } from "../lib/chartEngine";

const SERIES_COLORS = { y1: "#246bfe", y2: "#15915b" };

function formatTick(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (Math.abs(n) >= 100) return Math.round(n).toString();
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

export default function CustomChartPanel({ config, data, operationMode = "discharge" }) {
  if (!config || data.length === 0) {
    return (
      <div className="custom-chart-empty panel">
        <p>Select axes and apply to view a live custom chart.</p>
      </div>
    );
  }

  const processed = data.map((row) => ({
    ...row,
    [config.x]: typeof row[config.x] === "number" ? row[config.x] : Number(row[config.x]) || 0,
    [config.y1]: Number(row[config.y1]) || 0,
    ...(config.y2 ? { [config.y2]: Number(row[config.y2]) || 0 } : {})
  }));

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
  const chartMargin = {
    top: 16,
    right: useDual ? 52 : 20,
    left: 56,
    bottom: config.y2 ? 36 : 28
  };

  function renderSeries() {
    if (config.chart === "area") {
      return (
        <>
          <defs>
            <linearGradient id="custom-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SERIES_COLORS.y1} stopOpacity={0.75} />
              <stop offset="95%" stopColor={SERIES_COLORS.y1} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={config.y1} stroke={SERIES_COLORS.y1} fill="url(#custom-area-gradient)" isAnimationActive={false} />
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
        isAnimationActive={false}
      />
    );
  }

  const ChartType = config.chart === "area" ? AreaChart : LineChart;

  return (
    <div className="custom-chart-panel panel">
      <div className="custom-chart-panel-head">
        <h3>{config.title}</h3>
        <div className="custom-chart-legend-row">
          <span className="custom-legend-item" style={{ color: SERIES_COLORS.y1 }}>{y1Label}</span>
          {config.y2 ? (
            <span className="custom-legend-item" style={{ color: SERIES_COLORS.y2 }}>{y2Label}</span>
          ) : null}
        </div>
      </div>
      {config.warning ? <p className="custom-chart-warning">{config.warning}</p> : null}
      <div className="custom-chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <ChartType data={processed} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey={config.x}
              domain={xDomain}
              tickFormatter={formatTick}
              tick={{ fill: "var(--text-main)", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              label={{ value: xLabel, position: "insideBottom", offset: -4, fill: "var(--text-muted)", fontSize: 10 }}
            />
            <YAxis
              yAxisId="left"
              domain={y1Domain}
              tickFormatter={formatTick}
              tick={{ fill: "var(--text-main)", fontSize: 10 }}
              tickLine={{ stroke: "var(--border-strong)" }}
              axisLine={{ stroke: "var(--border-strong)" }}
              width={56}
            />
            {useDual ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={y2Domain}
                tickFormatter={formatTick}
                tick={{ fill: "var(--text-main)", fontSize: 10 }}
                tickLine={{ stroke: "var(--border-strong)" }}
                axisLine={{ stroke: "var(--border-strong)" }}
                width={56}
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
  );
}

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
