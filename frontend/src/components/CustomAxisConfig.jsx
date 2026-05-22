import { useState } from "react";
import { Settings, X } from "lucide-react";

function CustomAxisConfig({ onApply, onClose }) {
  const [showConfig, setShowConfig] = useState(false);
  const [customLabels, setCustomLabels] = useState({
    xlabel: "",
    ylabel: "",
    yRange: { min: 0, max: 100 }
  });

  const handleApply = () => {
    onApply(customLabels);
    setShowConfig(false);
  };

  return (
    <>
      <button
        className="custom-axis-btn"
        onClick={() => setShowConfig(!showConfig)}
        title="Configure custom labels"
      >
        <Settings size={18} /> Labels
      </button>

      {showConfig && (
        <div className="custom-axis-config">
          <div className="config-header">
            <h4>Custom Axis Labels</h4>
            <button onClick={() => setShowConfig(false)} className="close-btn">
              <X size={18} />
            </button>
          </div>
          <div className="config-body">
            <div className="config-input-group">
              <label>X-Axis Label</label>
              <input
                type="text"
                value={customLabels.xlabel}
                onChange={(e) => setCustomLabels({ ...customLabels, xlabel: e.target.value })}
                placeholder="e.g., Time (seconds)"
              />
            </div>
            <div className="config-input-group">
              <label>Y-Axis Label</label>
              <input
                type="text"
                value={customLabels.ylabel}
                onChange={(e) => setCustomLabels({ ...customLabels, ylabel: e.target.value })}
                placeholder="e.g., Voltage (V)"
              />
            </div>
            <div className="config-input-group">
              <label>Y-Axis Min</label>
              <input
                type="number"
                value={customLabels.yRange.min}
                onChange={(e) => setCustomLabels({
                  ...customLabels,
                  yRange: { ...customLabels.yRange, min: Number(e.target.value) }
                })}
              />
            </div>
            <div className="config-input-group">
              <label>Y-Axis Max</label>
              <input
                type="number"
                value={customLabels.yRange.max}
                onChange={(e) => setCustomLabels({
                  ...customLabels,
                  yRange: { ...customLabels.yRange, max: Number(e.target.value) }
                })}
              />
            </div>
          </div>
          <div className="config-footer">
            <button className="config-btn-cancel" onClick={() => setShowConfig(false)}>
              Cancel
            </button>
            <button className="config-btn-apply" onClick={handleApply}>
              Apply
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default CustomAxisConfig;
