import { X, Zap, RotateCcw, Activity } from "lucide-react";

function MiniChartPreview({ color, points }) {
  const max = Math.max(...points, 1);
  return (
    <div className="operation-mini-chart" style={{ borderTopColor: color }}>
      <div className="operation-mini-bars">
        {points.map((v, i) => (
          <span
            key={i}
            style={{ height: `${(v / max) * 100}%`, backgroundColor: color }}
          />
        ))}
      </div>
      <div className="operation-mini-axis">
        <span>0</span>
        <span>time →</span>
      </div>
    </div>
  );
}

function ChargeDischargeModal({ isOpen, onClose, onSelect, loading = false }) {
  if (!isOpen) return null;

  return (
    <div className="config-modal-overlay">
      <div className="config-modal operation-modal">
        <div className="config-modal-header">
          <h2>Battery Operation</h2>
          <button type="button" className="close-button" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div className="config-modal-content">
          <p className="operation-modal-lead">Choose a cycle. Configuration opens next.</p>
          <div className="operation-cards">
            <button
              type="button"
              className="operation-card operation-discharge"
              onClick={() => onSelect("discharge")}
              disabled={loading}
            >
              <div className="operation-card-icon">
                <RotateCcw size={28} />
              </div>
              <div className="operation-card-body">
                <strong>Discharge</strong>
                <span>Drone profile, C-rating, capacity</span>
              </div>
              <MiniChartPreview color="#dc2626" points={[82, 70, 58, 45, 38, 30, 22]} />
            </button>

            <button
              type="button"
              className="operation-card operation-charge"
              onClick={() => onSelect("charge")}
              disabled={loading}
            >
              <div className="operation-card-icon">
                <Zap size={28} />
              </div>
              <div className="operation-card-body">
                <strong>Charge</strong>
                <span>Chemistry, pack voltage, charge current</span>
              </div>
              <MiniChartPreview color="#15915b" points={[18, 28, 40, 55, 68, 78, 88]} />
            </button>
          </div>
          <div className="operation-modal-hint">
            <Activity size={14} />
            <span>Live charts use the same style as the global dashboard.</span>
          </div>
        </div>

        <div className="config-modal-footer">
          <button type="button" className="config-btn cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChargeDischargeModal;
