import { VARIABLES } from "./chartEngine";

const ZERO_BASED_METRICS = new Set(["current", "power", "soc", "soh"]);

const CHARGE_RANGES = {
  voltage: { min: 0, max: 60, pad: 0.05 },
  current: { min: 0, max: 50, pad: 0.1 },
  power: { min: 0, max: 500, pad: 0.1 },
  temperature: { min: 0, max: 100, pad: 0.08 },
  soc: { min: 0, max: 100 },
  soh: { min: 0, max: 100 }
};

const DISCHARGE_RANGES = {
  voltage: { min: 0, max: 60, pad: 0.08 },
  current: { min: 0, max: 50, pad: 0.12 },
  power: { min: 0, max: 500, pad: 0.12 },
  temperature: { min: 0, max: 100, pad: 0.1 },
  soc: { min: 0, max: 100 },
  soh: { min: 0, max: 100 }
};

function resolveFixedRange(metricKey, operationMode = "discharge") {
  const preset = operationMode === "charge" ? CHARGE_RANGES : DISCHARGE_RANGES;
  const range = preset[metricKey] ?? CHARGE_RANGES[metricKey];
  if (!range) return null;

  const fallback = CHARGE_RANGES[metricKey] ?? {};
  let min = range.min ?? fallback.min ?? 0;
  let max = range.max ?? fallback.max;

  if (ZERO_BASED_METRICS.has(metricKey) && (min == null || min < 0)) {
    min = 0;
  }

  if (max == null) {
    max = fallback.max ?? min + 1;
  }

  if (min >= max) {
    max = min + 1;
  }

  return [min, max];
}

/** Fixed Y domain from expected sensor range — does not rescale with incoming data. */
export function getFixedMetricYDomain(metricKey, operationMode = "discharge") {
  const domain = resolveFixedRange(metricKey, operationMode);
  if (domain) return domain;
  return [0, 1];
}

/** @deprecated Use getFixedMetricYDomain for chart rendering. Kept for compatibility. */
export function getMetricYDomain(metricKey, values, operationMode = "discharge") {
  const fixed = resolveFixedRange(metricKey, operationMode);
  if (fixed) return fixed;

  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [0, 1];

  const dataMin = Math.min(...finite);
  const dataMax = Math.max(...finite);
  if (dataMin >= dataMax) return [dataMin, dataMax + 1];
  return [dataMin, dataMax];
}

export function getCustomYDomain(metricKey, values, operationMode = "discharge") {
  if (VARIABLES[metricKey]?.type === "percentage") {
    return [0, 100];
  }
  return getFixedMetricYDomain(metricKey, operationMode);
}
