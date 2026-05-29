/** Shared tick, domain, and scroll helpers for all Recharts telemetry views. */

export const DEFAULT_VISIBLE_SECONDS = 60;
export const PIXELS_PER_SECOND = 18;
export const MIN_CHART_SCROLL_WIDTH = 560;
export const DEFAULT_Y_TICK_COUNT = 5;

/** Shared layout so scroll plot and fixed Y-axis overlay share the same origin. */
export const Y_AXIS_WIDTH = 46;
// Wider overlay so rotated Y-axis labels never clip.
export const Y_AXIS_OVERLAY_WIDTH = 92;

/** Reserved band for X ticks + label; must match on scroll + overlay charts. */
export const X_AXIS_RESERVED_HEIGHT = 40;
/** Extra padding below the X-axis band so Y=0 tick is never clipped. */
export const CHART_MARGIN_BOTTOM = 22;
export const CHART_MARGIN_TOP = 10;

export const CHART_MARGIN = {
  top: CHART_MARGIN_TOP,
  right: 16,
  // Nudge plot right slightly so left-most tick labels ("0") are not clipped.
  left: Y_AXIS_OVERLAY_WIDTH + 4,
  bottom: CHART_MARGIN_BOTTOM
};
export const Y_AXIS_OVERLAY_MARGIN = {
  top: CHART_MARGIN_TOP,
  right: 0,
  // Keep the Y-axis line aligned with the scroll chart plot origin:
  // scroll chart plot origin x ~= CHART_MARGIN.left, so inside the overlay chart
  // we need margin.left so that axisLine appears at the same x coordinate.
  left: Y_AXIS_OVERLAY_WIDTH - Y_AXIS_WIDTH + 4,
  bottom: CHART_MARGIN_BOTTOM
};
export const CUSTOM_CHART_MARGIN_TOP = 16;
export const CUSTOM_CHART_MARGIN = {
  top: CUSTOM_CHART_MARGIN_TOP,
  right: 20,
  left: Y_AXIS_OVERLAY_WIDTH + 4,
  bottom: CHART_MARGIN_BOTTOM
};
export const CUSTOM_Y_AXIS_OVERLAY_MARGIN = {
  // Nudge the overlay axis a few pixels down so the Y axis lines up
  // visually with the scroll chart's origin (fixes tiny vertical gap).
  top: CUSTOM_CHART_MARGIN_TOP + 4,
  right: 0,
  left: Y_AXIS_OVERLAY_WIDTH - Y_AXIS_WIDTH + 4,
  bottom: CHART_MARGIN_BOTTOM
};
export const CUSTOM_CHART_MARGIN_DUAL_RIGHT = {
  top: CUSTOM_CHART_MARGIN_TOP,
  right: Y_AXIS_OVERLAY_WIDTH,
  left: Y_AXIS_OVERLAY_WIDTH + 4,
  bottom: CHART_MARGIN_BOTTOM
};
export const CUSTOM_Y_AXIS_OVERLAY_MARGIN_RIGHT = {
  top: CUSTOM_CHART_MARGIN_TOP + 4,
  right: 12,
  left: 0,
  bottom: CHART_MARGIN_BOTTOM
};

export const AXIS_X_PROPS = {
  type: "number",
  allowDecimals: false,
  scale: "linear",
  height: X_AXIS_RESERVED_HEIGHT,
  // Ensure no implicit left padding so the "0" tick lines up with Y axis
  padding: { left: 0, right: 0 },
  // Prevent axis from rendering outside the plot area so origin aligns
  allowDataOverflow: false,
  tickMargin: 6
};

export const AXIS_Y_PROPS = {
  scale: "linear",
  allowDataOverflow: false
};

export const Y_AXIS_TICK_STYLE = {
  fill: "var(--text-main)",
  fontSize: 10
};

/** Placeholder X-axis so overlay charts keep the same plot height as the scroll chart. */
export function xAxisPlaceholderProps(dataKey, domain) {
  return {
    ...AXIS_X_PROPS,
    dataKey,
    domain,
    axisLine: false,
    tick: false,
    tickLine: false
  };
}

export function xAxisLabelProps(label) {
  return {
    value: label,
    // InsideBottom to avoid clipping against the scroll container bottom.
    position: "insideBottom",
    offset: -2,
    fill: "var(--text-muted)",
    fontSize: 10
  };
}

/** Recharts Y domain as a strict numeric tuple anchored at sensor zero. */
export function toYDomain(domain) {
  const [min, max] = domain;
  return [Number(min), Number(max)];
}

function niceTimeStep(roughStep) {
  if (roughStep <= 1) return 1;
  if (roughStep <= 2) return 2;
  if (roughStep <= 5) return 5;
  if (roughStep <= 10) return 10;
  if (roughStep <= 15) return 15;
  if (roughStep <= 30) return 30;
  return Math.ceil(roughStep / 60) * 60;
}

/** Readable integer-second ticks across the visible time span. */
export function buildTimeTicks(min, max, maxTicks = 12) {
  const lo = Math.floor(min);
  const hi = Math.ceil(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return [0];
  const step = niceTimeStep((hi - lo) / Math.max(1, maxTicks - 1));
  const start = Math.ceil(lo / step) * step;
  const ticks = [];
  if (lo === 0) ticks.push(0);
  for (let t = start; t <= hi; t += step) {
    if (!ticks.includes(t)) ticks.push(t);
  }
  if (!ticks.includes(hi)) ticks.push(hi);
  return ticks;
}

export function formatTimeTick(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.round(n)) : String(value);
}

function plotScrollWidth(spanSeconds, rightMargin = CHART_MARGIN.right) {
  return Y_AXIS_OVERLAY_WIDTH + spanSeconds * PIXELS_PER_SECOND + rightMargin;
}

export const SERIES_CLIP_PROPS = { clipDot: false, isAnimationActive: false };

export function getTimeAxisExtent(timeValues, visibleSeconds = DEFAULT_VISIBLE_SECONDS) {
  if (!timeValues?.length) {
    const end = Math.max(1, visibleSeconds) - 1;
    return {
      domain: [0, end],
      ticks: buildTimeTicks(0, end),
      scrollWidth: Math.max(MIN_CHART_SCROLL_WIDTH, plotScrollWidth(visibleSeconds))
    };
  }

  const dataMin = Math.floor(Math.min(...timeValues));
  const dataMax = Math.ceil(Math.max(...timeValues));
  const domainMin = Math.min(0, dataMin);
  const domainMax = Math.max(dataMax, domainMin + Math.max(1, visibleSeconds) - 1);
  const span = domainMax - domainMin + 1;

  return {
    domain: [domainMin, domainMax],
    ticks: buildTimeTicks(domainMin, domainMax),
    scrollWidth: plotScrollWidth(span)
  };
}

export function computeChartScrollWidth(timeValues, visibleSeconds = DEFAULT_VISIBLE_SECONDS) {
  return getTimeAxisExtent(timeValues, visibleSeconds).scrollWidth;
}

function decimalsForStep(step) {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  if (step >= 0.01) return 2;
  return 3;
}

function roundToDecimals(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Pick 1, 2, 2.5, 5, or 10 × 10^n for readable tick spacing. */
function niceStep(roughStep) {
  if (!Number.isFinite(roughStep) || roughStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(roughStep));
  const fraction = roughStep / 10 ** exponent;
  let niceFraction = 10;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 2.5) niceFraction = 2.5;
  else if (fraction <= 5) niceFraction = 5;
  return niceFraction * 10 ** exponent;
}

/**
 * Evenly spaced ticks using a "nice" step (10, 20, 50, 100, ...).
 *
 * Note: This may expand the max to the next step multiple so you get clean ticks
 * like 0,10,20,... instead of 0,13,25,38,50.
 */
export function getEvenTicksWithDomain(min, max, count = 6) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    const v = roundToDecimals(min, 2);
    return { domain: [v, v + 1], ticks: [v, v + 1], step: 1 };
  }
  if (min > max) [min, max] = [max, min];

  const desired = Math.max(2, count);
  const range = max - min;

  // Choose a "nice" step that yields ~5–7 ticks for common sensor ranges.
  let step = niceStep(range / (desired - 1));
  let best = { step, tickCount: Math.ceil(range / step) + 1, score: Infinity };
  for (let extra = 0; extra <= 4; extra += 1) {
    const candidateCount = desired + extra;
    const candidateStep = niceStep(range / (candidateCount - 1));
    const candidateTicks = Math.ceil(range / candidateStep) + 1;
    const score = Math.abs(candidateTicks - candidateCount) + (candidateTicks < 5 ? 10 : 0);
    if (score < best.score) {
      best = { step: candidateStep, tickCount: candidateTicks, score };
    }
  }
  step = best.step;
  const snappedMin = min;
  const snappedMax = snappedMin + step * Math.ceil((max - snappedMin) / step);
  const decimals = decimalsForStep(step);

  const ticks = [];
  for (let v = snappedMin; v <= snappedMax + step * 0.0001; v += step) {
    ticks.push(roundToDecimals(v, decimals));
  }

  return {
    domain: [roundToDecimals(snappedMin, decimals), roundToDecimals(snappedMax, decimals)],
    ticks: dedupeTicks(ticks),
    step
  };
}

/**
 * Requested shared utility.
 * Returns evenly spaced ticks spanning \[min, max\] (may expand max to a nice step).
 */
export function getEvenTicks(min, max, count = 6) {
  return getEvenTicksWithDomain(min, max, count).ticks;
}

/**
 * Dual-axis charts: same tick count on both sides so grid lines align.
 */
export function buildAlignedDualTicks(leftDomain, rightDomain, tickCount = DEFAULT_Y_TICK_COUNT) {
  const count = Math.max(2, tickCount);
  const left = getEvenTicksWithDomain(leftDomain[0], leftDomain[1], count);
  const right = getEvenTicksWithDomain(rightDomain[0], rightDomain[1], count);
  return {
    leftTicks: left.ticks,
    rightTicks: right.ticks,
    leftDomain: left.domain,
    rightDomain: right.domain
  };
}

/** Pin scroll to latest data only when content is wider than the viewport. */
export function scrollChartToEnd(scrollEl) {
  if (!scrollEl) return;
  if (scrollEl.scrollWidth <= scrollEl.clientWidth) {
    scrollEl.scrollLeft = 0;
    return;
  }
  scrollEl.scrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
}

export function isScrolledNearEnd(scrollEl, thresholdPx = 24) {
  if (!scrollEl) return true;
  if (scrollEl.scrollWidth <= scrollEl.clientWidth) return true;
  const distanceFromEnd = scrollEl.scrollWidth - scrollEl.clientWidth - scrollEl.scrollLeft;
  return distanceFromEnd <= thresholdPx;
}

function dedupeTicks(ticks) {
  const out = [];
  for (const tick of ticks) {
    if (!out.length || tick > out[out.length - 1]) out.push(tick);
  }
  return out.length ? out : [0];
}

export function formatValueTick(metricKey, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (metricKey === "soc" || metricKey === "soh") return `${Math.round(n)}`;
  if (Math.abs(n) >= 100) return Math.round(n).toString();
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

export function formatGenericValueTick(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Math.abs(n) >= 100) return Math.round(n).toString();
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}
