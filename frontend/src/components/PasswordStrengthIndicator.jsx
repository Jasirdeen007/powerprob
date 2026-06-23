import { useMemo } from "react";

function calculateStrength(password) {
  if (!password) return { score: 0, label: "", color: "transparent" };
  
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score <= 2) return { score: 1, label: "Weak", color: "#ef4444" };
  if (score <= 3) return { score: 2, label: "Fair", color: "#f97316" };
  if (score <= 4) return { score: 3, label: "Strong", color: "#22c55e" };
  return { score: 4, label: "Very Strong", color: "#16a34a" };
}

function PasswordStrengthIndicator({ password, showRules = false }) {
  const strength = useMemo(() => calculateStrength(password), [password]);
  
  if (!password) return null;
  
  return (
    <div className="password-strength" role="status" aria-live="polite">
      <div className="password-strength-bar">
        <div 
          className="password-strength-fill"
          style={{ 
            width: `${(strength.score / 4) * 100}%`,
            backgroundColor: strength.color 
          }}
        />
      </div>
      <span className="password-strength-label" style={{ color: strength.color }}>
        {strength.label}
      </span>
      
      {showRules && (
        <ul className="password-strength-rules" aria-label="Password requirements">
          <li className={password.length >= 8 ? "met" : ""}>
            At least 8 characters
          </li>
          <li className={/[A-Z]/.test(password) ? "met" : ""}>
            One uppercase letter
          </li>
          <li className={/[a-z]/.test(password) ? "met" : ""}>
            One lowercase letter
          </li>
          <li className={/[0-9]/.test(password) ? "met" : ""}>
            One number
          </li>
          <li className={/[^a-zA-Z0-9]/.test(password) ? "met" : ""}>
            One special character
          </li>
        </ul>
      )}
    </div>
  );
}

export default PasswordStrengthIndicator;
