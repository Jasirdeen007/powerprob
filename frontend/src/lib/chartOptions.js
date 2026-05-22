import {
  AreaChart,
  LineChart,
  ScatterChart,
  Gauge,
  Donut,
  BarChart3
} from "lucide-react";

export const ALLOWED_CHARTS = {
  voltage: ["line", "area", "scatter"],
  current: ["line", "area", "step"],
  temperature: ["line", "area", "scatter"],
  soc: ["gauge", "donut"],
  soh: ["gauge", "donut"],
  // Prefer gauge and line for SOC and SOH in the UI toggle options
  // (keep donut available historically but expose line as second option)
  // Update: replace donut with line to match requested UI
  soc: ["gauge", "line"],
  soh: ["gauge", "line"],
  power: ["area", "line", "scatter"]
};

const CHART_META = {
  line: { label: "Line", Icon: LineChart },
  area: { label: "Area", Icon: AreaChart },
  scatter: { label: "Scatter", Icon: ScatterChart },
  step: { label: "Step", Icon: LineChart },
  gauge: { label: "Gauge", Icon: Gauge },
  donut: { label: "Donut", Icon: Donut },
  progress: { label: "Progress", Icon: BarChart3 }
};

export function getDefaultChartType(metricKey) {
  const allowed = ALLOWED_CHARTS[metricKey];
  return allowed?.[0] ?? "line";
}

export function getChartOptionsForMetric(metricKey) {
  const allowed = ALLOWED_CHARTS[metricKey] ?? ALLOWED_CHARTS.voltage;
  return allowed.map((key) => ({
    key,
    label: CHART_META[key]?.label ?? key,
    Icon: CHART_META[key]?.Icon ?? LineChart
  }));
}
