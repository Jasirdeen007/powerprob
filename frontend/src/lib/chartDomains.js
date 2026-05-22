import { VARIABLES } from "./chartEngine";

const ZERO_BASED_METRICS = new Set(["current", "power", "soc", "soh"]);

const CHARGE_RANGES = {
  voltage: { min: 0, max: 60, pad: 0.05 },
  current: { min: 0, max: 50, pad: 0.1 },
  power: { min: 0, max: 500, pad: 0.1 },
  // Use a realistic full range for temperature (0–100°C) so charts start at 0
  temperature: { min: 0, max: 100, pad: 0.08 },
  soc: { min: 0, max: 100 },
  soh: { min: 0, max: 100 }
};

const DISCHARGE_RANGES = {
  voltage: { min: null, max: null, pad: 0.08 },
  current: { min: 0, max: null, pad: 0.12 },
  power: { min: 0, max: null, pad: 0.12 },
  // For discharge, allow temperature to start from 0 to capture full range
  temperature: { min: 0, max: 100, pad: 0.1 },
  soc: { min: 0, max: 100 },
  soh: { min: 0, max: 100 }
};

function roundUp(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.ceil(value * factor) / factor;
}

function roundDown(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.floor(value * factor) / factor;
}

export function getMetricYDomain(metricKey, values, operationMode = "discharge") {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) {
    return ["auto", "auto"];
  }

  const preset = operationMode === "charge" ? CHARGE_RANGES : DISCHARGE_RANGES;
  const range = preset[metricKey];
  if (!range) {
    return ["auto", "auto"];
  }

  if (range.min != null && range.max != null && range.min === 0 && range.max === 100) {
    return [0, 100];
  }

  const dataMin = Math.min(...finite);
  const dataMax = Math.max(...finite);
  const pad = range.pad ?? 0.1;

  let min = range.min;
  let max = range.max;

  if (ZERO_BASED_METRICS.has(metricKey) && (min == null || min === 0)) {
    min = 0;
  }

  if (min == null) {
    min = roundDown(dataMin - (dataMax - dataMin) * pad);
  }

  if (max == null) {
    max = roundUp(dataMax + (dataMax - dataMin || dataMax || 1) * pad);
  } else if (dataMax > max * 0.85) {
    max = roundUp(Math.max(max, dataMax * 1.1));
  }

  if (min >= max) {
    max = min + 1;
  }

  return [min, max];
}

export function getCustomYDomain(metricKey, values, operationMode = "discharge") {
  if (VARIABLES[metricKey]?.type === "percentage") {
    return [0, 100];
  }
  return getMetricYDomain(metricKey, values, operationMode);
}
