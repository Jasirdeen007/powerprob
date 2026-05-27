export const VARIABLES = {
  time: { type: "temporal", unit: "s", label: "Time" },
  voltage: { type: "continuous", unit: "V", label: "Voltage" },
  current: { type: "continuous", unit: "A", label: "Current" },
  temperature: { type: "continuous", unit: "°C", label: "Temp" },
  soc: { type: "percentage", unit: "%", label: "SOC" },
  soh: { type: "percentage", unit: "%", label: "SOH" },
  power: { type: "continuous", unit: "W", label: "Power" }
};

export const VARIABLE_KEYS = Object.keys(VARIABLES);

export const X_AXIS_KEYS = ["time", "current", "voltage"];

export const COMPATIBLE_Y_BY_X = {
  time: ["voltage", "current", "temperature", "power", "soc", "soh"],
  current: ["voltage", "temperature", "power"],
  voltage: ["current", "temperature", "soc"]
};

const WEAK_PAIRS = new Set([
  "temperature|soh",
  "soh|temperature",
  "soc|soh",
  "soh|soc"
]);

export class ChartSelectionError extends Error {
  constructor(message) {
    super(message);
    this.name = "ChartSelectionError";
  }
}

export function normalizeSelection(x, y1, y2) {
  const raw = [x, y1, y2].filter(Boolean);
  const timeKey = raw.find((key) => VARIABLES[key]?.type === "temporal");
  const nonTime = raw.filter((key) => key !== timeKey);

  if (timeKey) {
    return {
      x: timeKey,
      y1: nonTime[0] ?? y1,
      y2: nonTime[1] ?? null
    };
  }

  return { x, y1, y2: y2 || null };
}

export function validateSelection(x, y1, y2) {
  if (!VARIABLES[x] || !VARIABLES[y1]) {
    throw new ChartSelectionError("Unknown telemetry parameter selected.");
  }
  if (y2 && !VARIABLES[y2]) {
    throw new ChartSelectionError("Unknown telemetry parameter selected.");
  }
  if (x === y1 || x === y2 || (y2 && y1 === y2)) {
    throw new ChartSelectionError("Duplicate parameters not allowed.");
  }
}

export function shouldUseDualAxis(y1, y2) {
  if (!y2) return false;
  return VARIABLES[y1].unit !== VARIABLES[y2].unit;
}

export function chooseChart(x, y1, y2 = null) {
  if (y2) {
    if (x === "time") {
      return { chart: "multi_line", dual_axis: shouldUseDualAxis(y1, y2) };
    }
    return { chart: "scatter", dual_axis: false };
  }

  if (x === "time") {
    if (y1 === "power") {
      return { chart: "area", dual_axis: false };
    }
    return { chart: "line", dual_axis: false };
  }

  return { chart: "scatter", dual_axis: false };
}

export function buildAxisLabel(key, domain = null) {
  const meta = VARIABLES[key];
  if (!meta) return key;

  if (meta.type === "percentage") {
    return `${meta.label} (0–100%)`;
  }

  if (domain && Array.isArray(domain) && domain.length === 2 && domain.every(Number.isFinite)) {
    const [min, max] = domain;
    const unit = meta.unit;
    if (key === "time") {
      // Do not show unit for time on axis labels; show rounded range only
      return `Time (${Math.round(min)}–${Math.round(max)})`;
    }
    const decimals = key === "temperature" ? 0 : key === "current" ? 1 : 1;
    return `${meta.label} (${min.toFixed(decimals)}–${max.toFixed(decimals)} ${unit})`;
  }

  return `${meta.label} (${meta.unit})`;
}

export function buildTitle(x, y1, y2) {
  const y1Label = VARIABLES[y1].label;
  const xLabel = VARIABLES[x].label;
  if (y2) {
    return `${y1Label} & ${VARIABLES[y2].label} vs ${xLabel}`;
  }
  return `${y1Label} vs ${xLabel}`;
}

export function getInsightWarning(x, y1, y2) {
  const pair = y2 ? `${y1}|${y2}` : `${y1}|${x}`;
  const reverse = y2 ? `${y2}|${y1}` : `${x}|${y1}`;
  if (WEAK_PAIRS.has(pair) || WEAK_PAIRS.has(reverse)) {
    return "This combination may not provide meaningful real-time insights.";
  }
  return null;
}

export function getSuggestions(x) {
  return COMPATIBLE_Y_BY_X[x] ?? [];
}

export function getCompatibleYOptions(x, selected = []) {
  const blocked = new Set(selected.filter(Boolean));
  return (COMPATIBLE_Y_BY_X[x] ?? []).filter((key) => !blocked.has(key));
}

export function isCompatibleSelection(x, y1, y2 = null) {
  if (!X_AXIS_KEYS.includes(x)) return false;
  const compatible = COMPATIBLE_Y_BY_X[x] ?? [];
  if (!compatible.includes(y1)) return false;
  if (y2 && (x !== "time" || !compatible.includes(y2))) return false;
  return true;
}

export function resolveChartConfig(x, y1, y2) {
  const y2Clean = y2 && VARIABLES[y2] ? y2 : null;
  const normalized = normalizeSelection(x, y1, y2Clean);
  validateSelection(normalized.x, normalized.y1, normalized.y2);
  if (!isCompatibleSelection(normalized.x, normalized.y1, normalized.y2)) {
    throw new ChartSelectionError("Choose a meaningful telemetry comparison.");
  }
  const choice = chooseChart(normalized.x, normalized.y1, normalized.y2);
  return {
    ...normalized,
    ...choice,
    title: buildTitle(normalized.x, normalized.y1, normalized.y2),
    xLabel: buildAxisLabel(normalized.x),
    y1Label: buildAxisLabel(normalized.y1),
    y2Label: normalized.y2 ? buildAxisLabel(normalized.y2) : null,
    warning: getInsightWarning(normalized.x, normalized.y1, normalized.y2),
    suggestions: getSuggestions(normalized.x)
  };
}
