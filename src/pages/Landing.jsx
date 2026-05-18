import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  Eye,
  EyeOff,
  Gauge,
  LineChart,
  LockKeyhole,
  LoaderCircle,
  Mail,
  UserRound,
  Zap
} from "lucide-react";

function Landing({ mode, onEnterApp, onShowLogin, onShowSignup, onBackHome, onAuthSubmit, authPending, authError }) {
  const isAuthMode = mode === "login" || mode === "signup";

  return (
    <div className="landing-root">
      <header className="landing-topnav">
        <div className="landing-brand">
          <span className="landing-logo"><BatteryCharging size={24} /></span>
          <strong>PowerProbe</strong>
        </div>
        <div className="landing-actions">
          <button className="landing-btn ghost" onClick={onShowLogin} type="button">
            <UserRound size={16} /> Login
          </button>
          <button className="landing-btn primary" onClick={onShowSignup} type="button">
            Get started <ArrowRight size={16} />
          </button>
        </div>
      </header>

      <main className="landing-main">
        {isAuthMode ? (
          <AuthPanel
            mode={mode}
            onBackHome={onBackHome}
            onAuthSubmit={onAuthSubmit}
            onSwitchMode={mode === "login" ? onShowSignup : onShowLogin}
            authPending={authPending}
            authError={authError}
          />
        ) : (
          <Hero onEnterApp={onEnterApp} />
        )}
      </main>
    </div>
  );
}

function Hero({ onEnterApp }) {
  return (
    <section className="landing-hero">
      <div className="landing-copy">
        <span className="landing-eyebrow"><Zap size={15} /> Cloud battery telemetry</span>
        <h1>
          Battery analytics
          <span>for live and historical insights</span>
        </h1>
        <p>
          Monitor live battery telemetry, inspect KPI charts, and explore historical records through flexible filters and CSV export.
        </p>
        <button className="landing-btn primary large" onClick={onEnterApp} type="button">
          Open dashboard <ArrowRight size={17} />
        </button>
      </div>

      <section className="landing-preview" aria-label="Dashboard preview">
        <div className="preview-head">
          <strong>Live Battery Dashboard</strong>
          <span>Healthy</span>
        </div>
        <div className="preview-metrics">
          <PreviewMetric icon={Zap} label="Voltage" value="3.92 V" />
          <PreviewMetric icon={Activity} label="Current" value="8.10 A" />
          <PreviewMetric icon={Gauge} label="SOH" value="95.8%" />
        </div>
        <div className="preview-chart">
          <LineChart size={56} />
          <div>
            <strong>Realtime stream</strong>
            <span>Firebase telemetry updates dashboard and history analytics instantly.</span>
          </div>
        </div>
      </section>
    </section>
  );
}

function PreviewMetric({ icon: Icon, label, value }) {
  return (
    <article>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AuthPanel({ mode, onBackHome, onAuthSubmit, onSwitchMode, authPending, authError }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === "signup";

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const fallbackName = form.email ? form.email.split("@")[0] : "Battery Test User";
    onAuthSubmit({
      mode: isSignup ? "signup" : "login",
      name: isSignup ? form.name.trim() || fallbackName : fallbackName,
      email: form.email,
      password: form.password,
      role: "User"
    });
  }

  return (
    <section className="auth-shell">
      <button className="landing-btn ghost back" onClick={onBackHome} type="button">
        <ArrowLeft size={16} /> Back
      </button>
      <form className="auth-card" onSubmit={handleSubmit}>
        <div>
          <h1>{isSignup ? "Create account" : "Login"}</h1>
          <p>{isSignup ? "Create a demo account to enter the dashboard." : "Use email and password for this."}</p>
          {authError && <p className="auth-error">{authError}</p>}
        </div>

        {isSignup && (
          <label>
            Name
            <span>
              <UserRound size={17} />
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="User name" />
            </span>
          </label>
        )}

        <label>
          Email
          <span>
            <Mail size={17} />
            <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="user@example.com" required />
          </span>
        </label>

        <label>
          Password
          <span>
            <LockKeyhole size={17} />
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              placeholder="Password"
              required
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
          <small className="password-visibility">Password visible: {showPassword ? "Yes" : "No"}</small>
        </label>

        <button className="landing-btn primary large" type="submit" disabled={authPending}>
          {authPending ? (
            <>
              <LoaderCircle size={17} className="button-spinner" />
              Processing...
            </>
          ) : (
            <>
              {isSignup ? "Create account" : "Login"}
              <ArrowRight size={17} />
            </>
          )}
        </button>

        <button className="auth-switch" onClick={onSwitchMode} type="button">
          {isSignup ? "Already have an account? Login" : "New here? Create account"}
        </button>
      </form>
    </section>
  );
}

export default Landing;
