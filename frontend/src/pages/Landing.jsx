import { useEffect, useState } from "react";
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
import ToastNotification from "../components/ToastNotification";

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

      <PreviewCarousel />
    </section>
  );
}

function PreviewCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  
  const slides = [
    {
      title: "Live Battery Dashboard",
      status: "Healthy",
      metrics: [
        { icon: Zap, label: "Voltage", value: "3.92 V" },
        { icon: Activity, label: "Current", value: "8.10 A" },
        { icon: Gauge, label: "SOH", value: "95.8%" }
      ],
      descTitle: "Realtime stream",
      descText: "Firebase telemetry updates dashboard and history analytics instantly."
    },
    {
      title: "Historical Analytics",
      status: "Data Rich",
      metrics: [
        { icon: BatteryCharging, label: "Sessions", value: "248" },
        { icon: Activity, label: "Avg Temp", value: "32.4 °C" },
        { icon: LineChart, label: "Records", value: "14,592" }
      ],
      descTitle: "Deep Insights",
      descText: "Filter by battery, date, and mode to uncover performance trends."
    },
    {
      title: "Precision Simulation",
      status: "Active",
      metrics: [
        { icon: Zap, label: "C Rating", value: "25 C" },
        { icon: Activity, label: "Capacity", value: "2200 mAh" },
        { icon: Eye, label: "Profile", value: "Drone" }
      ],
      descTitle: "Configurable Tests",
      descText: "Run detailed simulation profiles directly against the hardware."
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="carousel-container" style={{ position: "relative", overflow: "hidden", borderRadius: "12px" }}>
      <div 
        className="carousel-track" 
        style={{ 
          display: "flex", 
          transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)", 
          transform: `translateX(-${activeIndex * 100}%)` 
        }}
      >
        {slides.map((slide, index) => (
          <div key={index} style={{ minWidth: "100%", padding: "4px" }}>
            <section className="landing-preview" aria-label="Dashboard preview">
              <div className="preview-head">
                <strong>{slide.title}</strong>
                <span>{slide.status}</span>
              </div>
              <div className="preview-metrics">
                {slide.metrics.map((m, i) => (
                  <PreviewMetric key={i} icon={m.icon} label={m.label} value={m.value} />
                ))}
              </div>
              <div className="preview-chart">
                <LineChart size={56} />
                <div>
                  <strong>{slide.descTitle}</strong>
                  <span>{slide.descText}</span>
                </div>
              </div>
            </section>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
        {slides.map((_, idx) => (
          <button 
            key={idx} 
            onClick={() => setActiveIndex(idx)}
            style={{ 
              width: "8px", height: "8px", borderRadius: "50%", 
              background: idx === activeIndex ? "#3b82f6" : "#cbd5e1", 
              border: "none", cursor: "pointer", transition: "background 0.3s" 
            }} 
          />
        ))}
      </div>
    </div>
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
  const [toastError, setToastError] = useState(null);
  const isSignup = mode === "signup";

  // Show toast when auth error changes
  useEffect(() => {
    if (authError) {
      setToastError(authError);
    }
  }, [authError]);

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
      <ToastNotification 
        message={toastError} 
        type="error" 
        duration={4000}
        onClose={() => setToastError(null)}
      />
      <button className="landing-btn ghost back" onClick={onBackHome} type="button">
        <ArrowLeft size={16} /> Back
      </button>
      <form className="auth-card" onSubmit={handleSubmit}>
        <div>
          <h1>{isSignup ? "Create account" : "Login"}</h1>
          <p>{isSignup ? "Create a demo account to enter the dashboard." : "Use email and password for this."}</p>
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
