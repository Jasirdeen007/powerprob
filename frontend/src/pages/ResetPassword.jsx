import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BatteryCharging,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  AlertCircle,
  Mail
} from "lucide-react";
import FormFieldError from "../components/FormFieldError";
import PasswordStrengthIndicator from "../components/PasswordStrengthIndicator";
import ToastNotification from "../components/ToastNotification";
import { confirmPasswordReset, verifyPasswordResetCode, sendPasswordReset } from "../firebaseClient";

function BrandLogo({ size = 28 }) {
  return (
    <span className="brand-logo-mark" aria-hidden="true">
      <BatteryCharging size={size} strokeWidth={2.25} />
    </span>
  );
}

function ResetPassword({ onBackToLogin }) {
  const [oobCode, setOobCode] = useState(null);
  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ password: "", confirmPassword: "" });
  const [touchedFields, setTouchedFields] = useState({ password: false, confirmPassword: false });

  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("error");

  const [status, setStatus] = useState("form");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestPending, setRequestPending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("oobCode");
    if (!code) {
      setVerifying(false);
      setVerifyError("No reset link detected. Please use the link from your email.");
      return;
    }
    setOobCode(code);
    verifyPasswordResetCode(code)
      .then(() => {
        setVerifying(false);
      })
      .catch((err) => {
        console.error("[ResetPassword] Verify failed:", err?.code, err?.message);
        setVerifying(false);
        const code = err?.code || "";
        if (code === "auth/expired-action-code") {
          setVerifyError("This reset link has expired. Request a new one.");
        } else if (code === "auth/invalid-action-code") {
          setVerifyError("This reset link is invalid or has already been used. Request a new one.");
        } else {
          setVerifyError("Unable to verify reset link. Please request a new one.");
        }
      });
  }, []);

  function validateField(field, value) {
    switch (field) {
      case "password": {
        if (!value) return "Password is required";
        if (value.length < 8) return "Password must be at least 8 characters";
        if (!/[A-Z]/.test(value)) return "Password must contain an uppercase letter";
        if (!/[a-z]/.test(value)) return "Password must contain a lowercase letter";
        if (!/[0-9]/.test(value)) return "Password must contain a number";
        return "";
      }
      case "confirmPassword": {
        if (!value) return "Please confirm your password";
        if (value !== password) return "Passwords do not match";
        return "";
      }
      default:
        return "";
    }
  }

  function updateField(field, value) {
    if (field === "password") setPassword(value);
    if (field === "confirmPassword") setConfirmPassword(value);
    if (touchedFields[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
    }
    if (field === "password" && touchedFields.confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: validateField("confirmPassword", confirmPassword) }));
    }
  }

  function handleBlur(field) {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    const value = field === "password" ? password : confirmPassword;
    setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const pwError = validateField("password", password);
    const confirmError = validateField("confirmPassword", confirmPassword);
    setFieldErrors({ password: pwError, confirmPassword: confirmError });
    setTouchedFields({ password: true, confirmPassword: true });
    if (pwError || confirmError) return;

    setSubmitting(true);
    try {
      await confirmPasswordReset(oobCode, password);
      setStatus("success");
    } catch (err) {
      console.error("[ResetPassword] Confirm failed:", err?.code, err?.message);
      const msg = err?.code === "auth/weak-password"
        ? "Password is too weak. Use a stronger password."
        : err?.code === "auth/expired-action-code"
        ? "Reset link expired. Request a new one."
        : err?.code === "auth/invalid-action-code"
        ? "Reset link is invalid or already used."
        : "Failed to reset password. Please try again.";
      setToastType("error");
      setToastMessage(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestNewLink(event) {
    event.preventDefault();
    if (!requestEmail.trim()) {
      setToastType("error");
      setToastMessage("Enter your email address to receive a new reset link.");
      return;
    }
    setRequestPending(true);
    try {
      await sendPasswordReset(requestEmail);
      setToastType("success");
      setToastMessage("If an account with that email exists, a new reset link has been sent.");
    } catch {
      setToastType("success");
      setToastMessage("If an account with that email exists, a new reset link has been sent.");
    } finally {
      setRequestPending(false);
    }
  }

  if (status === "success") {
    return (
      <section className="auth-shell">
        <div className="auth-card">
          <div className="auth-card-brand">
            <BrandLogo size={28} />
            <div>
              <h1>Password Reset Complete</h1>
              <p>Your password has been updated successfully.</p>
            </div>
          </div>
          <div className="reset-password-success">
            <div className="reset-password-success-icon">
              <CheckCircle2 size={48} />
            </div>
            <p className="reset-password-success-msg">Your password has been updated successfully.</p>
          </div>
          <button className="landing-btn primary large" type="button" onClick={onBackToLogin}>
            <ArrowLeft size={17} /> Back to Login
          </button>
        </div>
      </section>
    );
  }

  if (verifyError) {
    return (
      <section className="auth-shell">
        <ToastNotification
          message={toastMessage}
          type={toastType}
          duration={5000}
          onClose={() => setToastMessage(null)}
        />
        <div className="auth-card">
          <div className="auth-card-brand">
            <BrandLogo size={28} />
            <div>
              <h1>Reset Password</h1>
              <p>{verifyError}</p>
            </div>
          </div>
          <div className="reset-password-error-state">
            <div className="reset-password-error-icon">
              <AlertCircle size={48} />
            </div>
            <form onSubmit={handleRequestNewLink} className="reset-password-request-form">
              <label>
                Email
                <span>
                  <Mail size={17} />
                  <input
                    type="email"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    placeholder="user@example.com"
                    autoComplete="email"
                    required
                  />
                </span>
              </label>
              <button className="landing-btn primary large" type="submit" disabled={requestPending}>
                {requestPending ? (
                  <>
                    <LoaderCircle size={17} className="button-spinner" />
                    Sending...
                  </>
                ) : (
                  "Request New Reset Link"
                )}
              </button>
            </form>
          </div>
          <button className="auth-switch" onClick={onBackToLogin} type="button">
            Back to Login
          </button>
        </div>
      </section>
    );
  }

  if (verifying) {
    return (
      <section className="auth-shell">
        <div className="auth-card" style={{ textAlign: "center", padding: "48px 32px" }}>
          <LoaderCircle size={32} className="button-spinner" style={{ margin: "0 auto" }} />
          <p>Verifying your reset link...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-shell">
      <ToastNotification
        message={toastMessage}
        type={toastType}
        duration={5000}
        onClose={() => setToastMessage(null)}
      />
      <button className="landing-btn ghost back" onClick={onBackToLogin} type="button">
        <ArrowLeft size={16} /> Back
      </button>
      <form className="auth-card" onSubmit={handleSubmit} aria-label="Reset password">
        <div className="auth-card-brand">
          <BrandLogo size={28} />
          <div>
            <h1>Reset Your Password</h1>
            <p>Create a new password for your account.</p>
          </div>
        </div>

        <label>
          New Password
          <span className="password-input-wrap">
            <LockKeyhole size={17} />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => updateField("password", e.target.value)}
              onBlur={() => handleBlur("password")}
              placeholder="Enter new password"
              autoComplete="new-password"
              minLength={8}
              required
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? "rp-password-error" : undefined}
            />
            <button
              className="password-eye-button"
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
          <FormFieldError error={fieldErrors.password} id="rp-password-error" />
        </label>

        <PasswordStrengthIndicator password={password} showRules={true} />

        <label>
          Confirm Password
          <span className="password-input-wrap">
            <KeyRound size={17} />
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => updateField("confirmPassword", e.target.value)}
              onBlur={() => handleBlur("confirmPassword")}
              placeholder="Confirm new password"
              autoComplete="new-password"
              minLength={8}
              required
              aria-invalid={!!fieldErrors.confirmPassword}
              aria-describedby={fieldErrors.confirmPassword ? "rp-confirm-error" : undefined}
            />
            <button
              className="password-eye-button"
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              title={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
          <FormFieldError error={fieldErrors.confirmPassword} id="rp-confirm-error" />
        </label>

        <button className="landing-btn primary large" type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <LoaderCircle size={17} className="button-spinner" />
              Resetting...
            </>
          ) : (
            <>
              Reset Password
              <ArrowLeft size={17} style={{ transform: "rotate(180deg)" }} />
            </>
          )}
        </button>

        <button className="auth-switch" onClick={onBackToLogin} type="button">
          Back to Login
        </button>
      </form>
    </section>
  );
}

export default ResetPassword;
