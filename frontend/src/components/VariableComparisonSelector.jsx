import { useState } from "react";
import { X } from "lucide-react";

function VariableComparisonSelector({ isOpen, onClose, onApply, currentSelections = {} }) {
  const variables = [
    { key: "voltage", label: "Voltage (V)", icon: "⚡" },
    { key: "current", label: "Current (A)", icon: "🔌" },
    { key: "temperature", label: "Temperature (°C)", icon: "🌡️" },
    { key: "soc", label: "State of Charge (%)", icon: "🔋" },
    { key: "soh", label: "State of Health (%)", icon: "💚" },
    { key: "power", label: "Power Consumption (W)", icon: "⚙️" }
  ];

  const [var1, setVar1] = useState(currentSelections.var1 || "voltage");
  const [var2, setVar2] = useState(currentSelections.var2 || "current");
  const [var3, setVar3] = useState(currentSelections.var3 || "temperature");
  const [mode, setMode] = useState(currentSelections.mode || "three-variable");

  const handleApply = () => {
    onApply({ var1, var2, var3, mode });
    onClose();
  };

  const availableVars = variables.map(v => v.key);
  const remaining = availableVars.filter(v => v !== var1 && v !== var2 && v !== var3);

  if (!isOpen) return null;

  return (
    <div className="config-modal-overlay">
      <div className="config-modal comparison-modal">
        <div className="config-modal-header">
          <h2>Chart Comparison Setup</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="config-modal-content">
          {/* Mode Selection */}
          <div className="config-section">
            <h3>Comparison Mode</h3>
            <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
              <button
                onClick={() => setMode("three-variable")}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "6px",
                  border: mode === "three-variable" ? "2px solid #3b82f6" : "1px solid #e0e7ff",
                  background: mode === "three-variable" ? "#eff6ff" : "white",
                  color: mode === "three-variable" ? "#2563eb" : "#1a202c",
                  fontWeight: mode === "three-variable" ? "700" : "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                📊 Three Variables
              </button>
              <button
                onClick={() => setMode("two-variable")}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "6px",
                  border: mode === "two-variable" ? "2px solid #3b82f6" : "1px solid #e0e7ff",
                  background: mode === "two-variable" ? "#eff6ff" : "white",
                  color: mode === "two-variable" ? "#2563eb" : "#1a202c",
                  fontWeight: mode === "two-variable" ? "700" : "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                📈 Two Variables
              </button>
            </div>
          </div>

          {/* Variable Selection */}
          <div className="config-section">
            <h3>Select Variables</h3>
            
            {mode === "three-variable" ? (
              <div className="config-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className="config-field">
                  <label>First Variable (X-Axis)</label>
                  <select value={var1} onChange={(e) => setVar1(e.target.value)}>
                    {variables.map(v => (
                      <option key={v.key} value={v.key}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="config-field">
                  <label>Second Variable (Y-Axis)</label>
                  <select value={var2} onChange={(e) => setVar2(e.target.value)}>
                    {variables.map(v => (
                      <option key={v.key} value={v.key}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="config-field">
                  <label>Third Variable</label>
                  <select value={var3} onChange={(e) => setVar3(e.target.value)}>
                    {variables.map(v => (
                      <option key={v.key} value={v.key}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="config-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="config-field">
                  <label>First Variable (X-Axis)</label>
                  <select value={var1} onChange={(e) => setVar1(e.target.value)}>
                    {variables.map(v => (
                      <option key={v.key} value={v.key}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="config-field">
                  <label>Second Variable (Y-Axis)</label>
                  <select value={var2} onChange={(e) => setVar2(e.target.value)}>
                    {variables.map(v => (
                      <option key={v.key} value={v.key}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "12px", marginBottom: 0 }}>
              💡 Select different variables to create custom comparison charts
            </p>
          </div>
        </div>

        <div className="config-modal-footer">
          <button className="config-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="config-btn apply" onClick={handleApply}>
            Create Comparison
          </button>
        </div>
      </div>
    </div>
  );
}

export default VariableComparisonSelector;
