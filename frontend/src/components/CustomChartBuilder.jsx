import { useEffect, useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import {
  VARIABLE_KEYS,
  VARIABLES,
  X_AXIS_KEYS,
  ChartSelectionError,
  getCompatibleYOptions,
  resolveChartConfig
} from "../lib/chartEngine";
import CustomChartPanel from "./CustomChartPanel";

function axisOptions(keys = VARIABLE_KEYS) {
  return keys.map((key) => ({
    value: key,
    label: `${VARIABLES[key].label} (${VARIABLES[key].unit})`
  }));
}

export default function CustomChartBuilder({ data, operationMode = "discharge" }) {
  const [x, setX] = useState("time");
  const [y1, setY1] = useState("voltage");
  const [y2, setY2] = useState("");
  const [appliedConfig, setAppliedConfig] = useState(null);
  const [error, setError] = useState("");

  const xOptions = axisOptions(X_AXIS_KEYS);
  const y1Options = axisOptions(getCompatibleYOptions(x));
  const y2Options = x === "time" ? axisOptions(getCompatibleYOptions(x, [y1])) : [];

  useEffect(() => {
    const compatible = getCompatibleYOptions(x);
    if (!compatible.includes(y1)) {
      setY1(compatible[0] ?? "");
      setY2("");
      return;
    }
    if (x !== "time" && y2) {
      setY2("");
    } else if (y2 && !getCompatibleYOptions(x, [y1]).includes(y2)) {
      setY2("");
    }
  }, [x, y1, y2]);

  const duplicateError = useMemo(() => {
    if (!x || !y1) return "";
    if (x === y1) return "Duplicate parameters not allowed.";
    if (y2) {
      if (x === y2) return "Duplicate parameters not allowed.";
      if (y1 === y2) return "Duplicate parameters not allowed.";
    }
    return "";
  }, [x, y1, y2]);

  function handleApply() {
    setError("");
    try {
      const config = resolveChartConfig(x, y1, y2 || null);
      setAppliedConfig(config);
    } catch (err) {
      setAppliedConfig(null);
      setError(err instanceof ChartSelectionError ? err.message : "Invalid chart selection.");
    }
  }

  return (
    <section className="custom-chart-section">
      <div className="custom-chart-section-head">
        <h2><LineChart size={20} /> Custom Live Chart</h2>
        <p>Pick X and Y parameters. Time is auto-placed on the X-axis when selected.</p>
      </div>

      <div className="custom-chart-builder panel">
        <div className="custom-chart-selectors">
          <label>
            X-Axis
            <select value={x} onChange={(e) => setX(e.target.value)}>
              {xOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label>
            Y-Axis (primary)
            <select value={y1} onChange={(e) => setY1(e.target.value)}>
              {y1Options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label>
            Y-Axis (optional)
            <select value={y2} onChange={(e) => setY2(e.target.value)} disabled={x !== "time"}>
              <option value="">None</option>
              {y2Options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="config-btn apply custom-chart-apply"
            onClick={handleApply}
            disabled={!!duplicateError}
          >
            Apply Chart
          </button>
        </div>

        {error ? <p className="custom-chart-error">{error}</p> : null}
        {duplicateError ? <p className="custom-chart-error">{duplicateError}</p> : null}
        {appliedConfig?.warning && !error ? (
          <p className="custom-chart-warning inline">{appliedConfig.warning}</p>
        ) : null}
      </div>

      <CustomChartPanel config={appliedConfig} data={data} operationMode={operationMode} />
    </section>
  );
}
