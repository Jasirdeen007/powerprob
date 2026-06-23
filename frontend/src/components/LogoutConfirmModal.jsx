import { useEffect } from "react";
import { LogOut, X } from "lucide-react";

function LogoutConfirmModal({ isOpen, onConfirm, onCancel, currentUser }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="logout-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="logout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="logout-modal-close" onClick={onCancel} aria-label="Close" type="button">
          <X size={18} />
        </button>
        <div className="logout-modal-icon">
          <LogOut size={36} />
        </div>
        <h2 id="logout-modal-title">Sign out?</h2>
        {currentUser?.name && (
          <p className="logout-modal-user">
            {currentUser.name}
            {currentUser.email && <span>{currentUser.email}</span>}
          </p>
        )}
        <div className="logout-modal-actions">
          <button className="landing-btn ghost" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="landing-btn primary" onClick={onConfirm} type="button">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </section>
    </div>
  );
}

export default LogoutConfirmModal;
