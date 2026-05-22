import { useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import {
  VARIABLE_KEYS,
  VARIABLES,
  ChartSelectionError,
  resolveChartConfig,
  getSuggestions
} from "../lib/chartEngine";
import CustomChartPanel from "./CustomChartPanel";

function axisOptions(exclude = []) {
  return VARIABLE_KEYS.filter((key) => !exclude.includes(key)).map((key) => ({
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

  const xOptions = axisOptions();
  const y1Options = axisOptions([x]);
  const y2Options = axisOptions([x, y1]);

  const suggestions = useMemo(() => getSuggestions(x).filter((k) => k !== x && k !== y1), [x, y1]);

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

  function applySuggestion(key) {
    if (x !== "time" && key === "time") {
      setX("time");
      return;
    }
    if (!y2 || y2 === key) {
      if (y1 === key) return;
      setY2(key);
    } else {
      setY1(key);
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
            <select value={y2} onChange={(e) => setY2(e.target.value)}>
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

        {suggestions.length > 0 ? (
          <div className="custom-chart-suggestions">
            <span>Suggested:</span>
            {suggestions.map((key) => (
              <button key={key} type="button" className="suggestion-pill" onClick={() => applySuggestion(key)}>
                {VARIABLES[key].label}
              </button>
            ))}
          </div>
        ) : null}
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
