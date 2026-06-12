import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import { loadChemistries, saveCustomChemistry } from "../lib/chemistries";

function ChargeConfigurationModal({
  isOpen,
  onClose,
  onApply,
  batteryType,
  voltage,
  chargeCurrent,
  batteryName,
  onBatteryTypeChange,
  onVoltageChange,
  onChargeCurrentChange,
  onBatteryNameChange,
  userId
}) {
  const [localBatteryType, setLocalBatteryType] = useState(batteryType);
  const [localVoltage, setLocalVoltage] = useState(voltage);
  const [localChargeCurrent, setLocalChargeCurrent] = useState(chargeCurrent);
  const [localBatteryName, setLocalBatteryName] = useState(batteryName);
  const [chemistries, setChemistries] = useState(() => loadChemistries(userId));
  const [customChemistry, setCustomChemistry] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setLocalBatteryType(batteryType);
    setLocalVoltage(voltage);
    setLocalChargeCurrent(chargeCurrent);
    setLocalBatteryName(batteryName);
    setChemistries(loadChemistries(userId));
  }, [isOpen, batteryType, voltage, chargeCurrent, batteryName, userId]);

  if (!isOpen) return null;

  function handleAddChemistry() {
    const next = saveCustomChemistry(customChemistry, userId);
    setChemistries(next);
    const added = customChemistry.trim();
    if (added) {
      setLocalBatteryType(added);
      setCustomChemistry("");
    }
  }

  function handleApply() {
    onBatteryTypeChange(localBatteryType);
    onVoltageChange(localVoltage);
    onChargeCurrentChange(localChargeCurrent);
    if (onBatteryNameChange) {
      onBatteryNameChange(localBatteryName);
    }
    onApply();
  }

  return (
    <div className="config-modal-overlay">
      <div className="config-modal">
        <div className="config-modal-header">
          <h2>Charge Configuration</h2>
          <button className="close-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        <div className="config-modal-content">
          <p className="config-mode-hint">
            Balance charge mode is applied automatically for safe lithium charging.
          </p>

          <div className="config-section">
            <h3>Battery Information</h3>
            <div className="config-grid">
              <div className="config-field">
                <label>Battery Name (optional)</label>
                <input
                  type="text"
                  value={localBatteryName}
                  onChange={(e) => setLocalBatteryName(e.target.value)}
                  placeholder="e.g., Pack A"
                />
              </div>
            </div>
          </div>

          <div className="config-section">
            <h3>Charge Parameters</h3>
            <div className="config-grid">
              <div className="config-field">
                <label>Battery Type (chemistry)</label>
                <select value={localBatteryType} onChange={(e) => setLocalBatteryType(e.target.value)}>
                  {chemistries.map((chem) => (
                    <option key={chem} value={chem}>{chem}</option>
                  ))}
                </select>
              </div>
              <div className="config-field config-field-add">
                <label>Add custom chemistry</label>
                <div className="add-chemistry-row">
                  <input
                    type="text"
                    value={customChemistry}
                    onChange={(e) => setCustomChemistry(e.target.value)}
                    placeholder="e.g., LiHV"
                  />
                  <button type="button" className="config-btn apply" onClick={handleAddChemistry}>
                    <Plus size={16} /> Add
                  </button>
                </div>
              </div>
              <div className="config-field">
                <label>Pack Voltage (V)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={localVoltage}
                  onChange={(e) => setLocalVoltage(e.target.value)}
                  placeholder="e.g., 11.1 for 3S"
                />
              </div>
              <div className="config-field">
                <label>Charge Current (A)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={localChargeCurrent}
                  onChange={(e) => setLocalChargeCurrent(e.target.value)}
                  placeholder="e.g., 2.2 for 1C on 2200mAh"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="config-modal-footer">
          <button className="config-btn cancel" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="config-btn apply" onClick={handleApply} type="button">
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChargeConfigurationModal;
