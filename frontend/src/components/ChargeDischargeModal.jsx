import { X, Zap, RotateCcw } from "lucide-react";

function ChargeDischargeModal({ isOpen, onClose, onSelect, loading = false }) {
  if (!isOpen) return null;

  return (
    <div className="config-modal-overlay">
      <div className="config-modal charge-discharge-modal">
        <div className="config-modal-header">
          <h2>Battery Operation</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="config-modal-content">
          <p style={{ textAlign: "center", marginBottom: "24px", color: "var(--text-light)", fontSize: "0.95rem" }}>
            Select the operation mode for your battery
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {/* Discharge Option */}
            <button
              onClick={() => onSelect("discharge")}
              disabled={loading}
              style={{
                padding: "24px 16px",
                borderRadius: "10px",
                border: "2px solid #e0e7ff",
                background: "white",
                cursor: loading ? "wait" : "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                opacity: loading ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.background = "#eff6ff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e0e7ff";
                e.currentTarget.style.background = "white";
              }}
            >
              <RotateCcw size={32} color="#dc2626" />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1a202c" }}>Discharge</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Test battery discharge cycle</div>
              </div>
            </button>

            {/* Charge Option */}
            <button
              onClick={() => onSelect("charge")}
              disabled={loading}
              style={{
                padding: "24px 16px",
                borderRadius: "10px",
                border: "2px solid #e0e7ff",
                background: "white",
                cursor: loading ? "wait" : "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                opacity: loading ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.background = "#eff6ff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e0e7ff";
                e.currentTarget.style.background = "white";
              }}
            >
              <Zap size={32} color="#15915b" />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1a202c" }}>Charge</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Coming soon (not available)</div>
              </div>
            </button>
          </div>
        </div>

        <div className="config-modal-footer">
          <button className="config-btn cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChargeDischargeModal;
