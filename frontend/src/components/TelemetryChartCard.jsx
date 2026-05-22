import { useState } from "react";
import { LineChart as RLineChart, Line, AreaChart as RAreaChart, Area, BarChart as RBarChart, Bar, ScatterChart as RScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { AreaChart, BarChart3, LineChart, ScatterChart, Activity, Dot, ActivitySquare, Donut } from "lucide-react";

const COLORS = {
  safe: "#15915b",     // Green
  stable: "#246bfe",   // Blue
  warning: "#f59e0b",  // Yellow
  attention: "#d97706",// Orange
  critical: "#dc2626", // Red
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
  // Default fallback for current/power/resistance
  return COLORS.stable;
}

export default function TelemetryChartCard({ title, metricKey, unit, data, forceYRange, customAxisLabels }) {
  const chartOptions = {
    voltage: [
      { key: "line", Icon: LineChart, label: "Line Chart" },
      { key: "area", Icon: AreaChart, label: "Area Chart" },
      { key: "bar", Icon: BarChart3, label: "Bar Chart" }
    ],
    current: [
      { key: "area", Icon: AreaChart, label: "Area Chart" },
      { key: "line", Icon: LineChart, label: "Line Chart" },
      { key: "scatter", Icon: ScatterChart, label: "Scatter Plot" }
    ],
    temperature: [
      { key: "multiline", Icon: Activity, label: "Multi-line" },
      { key: "heatmap", Icon: AreaChart, label: "Heatmap Area" },
      { key: "area", Icon: AreaChart, label: "Area Chart" }
    ],
    soc: [
      { key: "donut", Icon: Donut, label: "Donut Chart" },
      { key: "area", Icon: AreaChart, label: "Area Chart" }
    ],
    soh: [
      { key: "donut", Icon: Donut, label: "Donut Chart" },
      { key: "area", Icon: AreaChart, label: "Area Chart" }
    ],
    power: [
      { key: "area", Icon: AreaChart, label: "Area Chart" },
      { key: "bar", Icon: BarChart3, label: "Bar Chart" },
      { key: "line", Icon: LineChart, label: "Line Chart" }
    ],
    resistance: [
      { key: "scatter", Icon: ScatterChart, label: "Scatter Plot" },
      { key: "line", Icon: LineChart, label: "Trend Line" },
      { key: "area", Icon: AreaChart, label: "Area Chart" }
    ]
  };

  // Determine Y-axis domain
  const getYAxisDomain = () => {
    if (forceYRange) {
      return [forceYRange.min, forceYRange.max];
    }
    if (data.length === 0) return ["auto", "auto"];
    const values = data.map(d => d[metricKey]).filter(Number.isFinite);
    if (values.length === 0) return ["auto", "auto"];
    const max = Math.max(...values);
    return ["auto", max];
  };

  const options = chartOptions[metricKey] || chartOptions.voltage;
  const [activeChart, setActiveChart] = useState(options[0].key);

  // Normalize data time values to numbers for Recharts
  const processedData = data.map((d) => ({ ...d, time: typeof d.time === "number" ? d.time : Number(d.time) || 0 }));
  const latestValue = processedData.length > 0 ? processedData[processedData.length - 1]?.[metricKey] ?? 0 : 0;
  const statusColor = getStatusColor(metricKey, latestValue);

  // Get axis labels
  const getAxisLabel = (type) => {
    if (customAxisLabels && customAxisLabels[type]) {
      return customAxisLabels[type];
    }
    if (type === "xlabel") {
      return "Time (s)";
    }
    if (type === "ylabel") {
      return `${title} (${unit})`;
    }
    return "";
  };

  function renderChart() {
    if (processedData.length === 0) return null;

    if (activeChart === "donut" || activeChart === "ring" || activeChart === "radial") {
      const remaining = 100 - latestValue;
      const pieData = [
        { name: "Value", value: latestValue },
        { name: "Remaining", value: remaining }
      ];
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill={statusColor} style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
              {`${latestValue.toFixed(0)}%`}
            </text>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={activeChart === "ring" || activeChart === "radial" ? "65%" : "60%"}
              outerRadius="85%"
              fill="#8884d8"
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={statusColor} />
              <Cell fill="var(--bg-lighter)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }

    // Default charts
    const chartContent = (() => {
      switch (activeChart) {
        case "bar":
          return <Bar dataKey={metricKey} fill={statusColor} radius={[2, 2, 0, 0]} isAnimationActive={false} />;
        case "area":
        case "heatmap":
          return (
            <>
              <defs>
                <linearGradient id={`gradient-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={statusColor} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={statusColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey={metricKey} stroke={statusColor} fillOpacity={1} fill={`url(#gradient-${metricKey})`} isAnimationActive={false} />
            </>
          );
        case "scatter":
          return <Scatter dataKey={metricKey} fill={statusColor} isAnimationActive={false} />;
        case "multiline":
          return (
            <>
              <Line type="monotone" dataKey={metricKey} stroke={statusColor} dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" dataKey="thermalLimit" stroke={COLORS.warning} strokeDasharray="3 3" dot={false} strokeWidth={1} isAnimationActive={false} />
              <Line type="monotone" dataKey="criticalLimit" stroke={COLORS.critical} strokeDasharray="3 3" dot={false} strokeWidth={1} isAnimationActive={false} />
            </>
          );
        case "line":
        default:
          return <Line type="monotone" dataKey={metricKey} stroke={statusColor} dot={false} strokeWidth={2} activeDot={{ r: 4 }} isAnimationActive={false} />;
      }
    })();

    const ChartComponent = (() => {
      switch (activeChart) {
        case "bar": return RBarChart;
        case "area":
        case "heatmap": return RAreaChart;
        case "scatter": return RScatterChart;
        case "line":
        case "multiline":
        default: return RLineChart;
      }
    })();

    const yAxisDomain = getYAxisDomain();

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={processedData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis 
            dataKey="time" 
            tick={{ fill: "var(--text-light)", fontSize: 10 }} 
            tickLine={false} 
            axisLine={false}
            label={{ value: getAxisLabel("xlabel"), position: "insideBottomRight", offset: -10, fill: "var(--text-light)", fontSize: 12 }}
          />
          <YAxis 
            domain={yAxisDomain} 
            tick={{ fill: "var(--text-light)", fontSize: 10 }} 
            tickLine={false} 
            axisLine={false}
            label={{ value: getAxisLabel("ylabel"), angle: -90, position: "insideLeft", fill: "var(--text-light)", fontSize: 12 }}
          />
          <Tooltip
            cursor={false}
            formatter={(value) => [Number(value).toFixed(2), title]}
            contentStyle={{ backgroundColor: "var(--bg-light)", border: "1px solid var(--border)", borderRadius: "4px" }}
            itemStyle={{ color: statusColor, fontWeight: "bold" }}
          />
          {chartContent}
        </ChartComponent>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="telemetry-chart-card panel" style={{ display: "flex", flexDirection: "column", height: "320px", padding: "12px", marginBottom: "8px", borderRadius: "10px", borderTop: `3px solid ${statusColor}` }}>
      <div className="panel-head" style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px" }}>
            {title}
            <span style={{ fontSize: "0.7rem", color: "var(--text-light)" }}>{unit}</span>
          </h3>
          <span style={{ fontSize: "1.25rem", fontWeight: "600", color: statusColor }}>
            {latestValue.toFixed(2)}
          </span>
        </div>
        <div className="visual-toggle" aria-label="Chart visualization type" style={{ display: "flex", gap: "2px" }}>
          {options.map(({ key, Icon, label }) => (
            <button
              key={key}
              className={activeChart === key ? "active" : ""}
              onClick={() => setActiveChart(key)}
              title={label}
              type="button"
              style={{
                background: activeChart === key ? "var(--bg-hover)" : "transparent",
                border: "none",
                padding: "4px",
                borderRadius: "4px",
                cursor: "pointer",
                color: activeChart === key ? statusColor : "var(--text-light)"
              }}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>
      <div className="chart-container" style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {renderChart()}
      </div>
    </div>
  );
}
