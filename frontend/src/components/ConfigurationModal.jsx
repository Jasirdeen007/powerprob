import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import { loadChemistries, saveCustomChemistry } from "../lib/chemistries";

function ConfigurationModal({
  isOpen,
  onClose,
  onApply,
  cRating,
  batteryType,
  mah,
  numCells,
  voltage,
  droneProfile,
  onCRatingChange,
  onBatteryTypeChange,
  onMahChange,
  onNumCellsChange,
  onVoltageChange,
  onDroneProfileChange,
  profiles = [],
  profileSpecs = {},
  profileDescriptions = {},
  batteryName = "",
  onBatteryNameChange
}) {
  const [localCRating, setLocalCRating] = useState(cRating);
  const [localBatteryType, setLocalBatteryType] = useState(batteryType);
  const [localMah, setLocalMah] = useState(mah);
  const [localNumCells, setLocalNumCells] = useState(numCells);
  const [localVoltage, setLocalVoltage] = useState(voltage);
  const [localDroneProfile, setLocalDroneProfile] = useState(droneProfile);
  const [localBatteryName, setLocalBatteryName] = useState(batteryName);
  const [chemistries, setChemistries] = useState(loadChemistries());
  const [customChemistry, setCustomChemistry] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setLocalCRating(cRating);
    setLocalBatteryType(batteryType);
    setLocalMah(mah);
    setLocalNumCells(numCells);
    setLocalVoltage(voltage);
    setLocalDroneProfile(droneProfile);
    setLocalBatteryName(batteryName);
    setChemistries(loadChemistries());
  }, [isOpen, cRating, batteryType, mah, numCells, voltage, droneProfile, batteryName]);

  function handleAddChemistry() {
    const next = saveCustomChemistry(customChemistry);
    setChemistries(next);
    const added = customChemistry.trim();
    if (added) {
      setLocalBatteryType(added);
      setCustomChemistry("");
    }
  }

  function handleDroneProfileChange(nextProfile) {
    setLocalDroneProfile(nextProfile);
    const specs = profileSpecs[nextProfile];
    if (!specs) return;

    setLocalCRating(specs.cRating);
    setLocalBatteryType(specs.batteryType);
    setLocalMah(specs.mah);
    setLocalNumCells(specs.numCells);
    setLocalVoltage(specs.voltage);
  }

  const handleApply = () => {
    onCRatingChange(localCRating);
    onBatteryTypeChange(localBatteryType);
    onMahChange(localMah);
    onNumCellsChange(localNumCells);
    onVoltageChange(localVoltage);
    onDroneProfileChange(localDroneProfile);
    if (onBatteryNameChange) {
      onBatteryNameChange(localBatteryName);
    }
    onApply();
  };

  if (!isOpen) return null;

  const profileOptions = profiles.length > 0
    ? profiles.map((profile) => ({ value: profile.name, label: profile.name }))
    : Object.keys(profileSpecs).map((name) => ({ value: name, label: name }));

  return (
    <div className="config-modal-overlay">
      <div className="config-modal">
        <div className="config-modal-header">
          <h2>Discharge Configuration</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="config-modal-content">
          {/* Battery Name Section */}
          <div className="config-section">
            <h3>Battery Information</h3>
            <div className="config-grid">
              <div className="config-field">
                <label>Battery Name</label>
                <input
                  type="text"
                  value={localBatteryName}
                  onChange={(e) => setLocalBatteryName(e.target.value)}
                  placeholder="e.g., Main Battery Pack"
                />
              </div>
            </div>
          </div>

          {/* Battery Specs Section */}
          <div className="config-section">
            <h3>Battery Specifications</h3>
            <div className="config-grid">
              <div className="config-field">
                <label>C Rating</label>
                <input
                  type="number"
                  value={localCRating}
                  onChange={(e) => setLocalCRating(e.target.value)}
                  placeholder="e.g., 25"
                />
              </div>
              <div className="config-field">
                <label>Battery Type</label>
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
                <label>Capacity (mAh)</label>
                <input
                  type="number"
                  value={localMah}
                  onChange={(e) => setLocalMah(e.target.value)}
                  placeholder="e.g., 2200"
                />
              </div>
              <div className="config-field">
                <label>Number of Cells</label>
                <input
                  type="number"
                  value={localNumCells}
                  onChange={(e) => setLocalNumCells(e.target.value)}
                  placeholder="e.g., 3"
                />
              </div>
              <div className="config-field">
                <label>Voltage (V)</label>
                <input
                  type="number"
                  step="0.1"
                  value={localVoltage}
                  onChange={(e) => setLocalVoltage(e.target.value)}
                  placeholder="e.g., 11.1"
                />
              </div>
            </div>
          </div>

          {/* Drone Profile Section */}
          <div className="config-section">
            <h3>Drone Profile</h3>
            <div className="config-field">
              <label>Select Drone Profile</label>
              <select value={localDroneProfile} onChange={(e) => handleDroneProfileChange(e.target.value)}>
                {profileOptions.map((profile) => (
                  <option key={profile.value} value={profile.value}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </div>
            {profileDescriptions[localDroneProfile] && (
              <p className="profile-description">{profileDescriptions[localDroneProfile]}</p>
            )}
          </div>
        </div>

        <div className="config-modal-footer">
          <button className="config-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="config-btn apply" onClick={handleApply}>
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfigurationModal;
