import { useEffect, useState } from "react";
import { Clock, LogOut } from "lucide-react";

function SessionTimeoutWarning({ remainingSeconds, onStaySignedIn, onSignOut }) {
  const [countdown, setCountdown] = useState(remainingSeconds);

  useEffect(() => {
    setCountdown(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    if (countdown <= 0) return;
    
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="session-timeout-backdrop" role="presentation">
      <section className="session-timeout-modal" role="dialog" aria-modal="true" aria-labelledby="session-timeout-title">
        <div className="session-timeout-icon">
          <Clock size={48} />
        </div>
        <h2 id="session-timeout-title">Session Expiring Soon</h2>
        <p className="session-timeout-message">
          You will be logged out in <strong>{timeString}</strong> due to inactivity.
        </p>
        <div className="session-timeout-actions">
          <button 
            className="landing-btn primary large"
            onClick={onStaySignedIn}
            type="button"
          >
            Stay signed in
          </button>
          <button 
            className="landing-btn ghost"
            onClick={onSignOut}
            type="button"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}

export default SessionTimeoutWarning;
