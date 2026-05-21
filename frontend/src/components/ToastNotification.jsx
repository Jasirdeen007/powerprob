import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";

function ToastNotification({ message, type = "error", duration = 4000, onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!message) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onClose) {
        setTimeout(onClose, 300); // Wait for fade out animation
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!isVisible || !message) return null;

  return (
    <div className={`toast-notification toast-${type} ${isVisible ? "toast-show" : "toast-hide"}`}>
      <div className="toast-content">
        <AlertCircle size={18} className="toast-icon" />
        <p className="toast-message">{message}</p>
      </div>
      <button
        className="toast-close"
        onClick={() => {
          setIsVisible(false);
          if (onClose) {
            setTimeout(onClose, 300);
          }
        }}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default ToastNotification;
