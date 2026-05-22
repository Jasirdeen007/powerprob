import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  ChevronLeft,
  ChevronRight,
  Gauge,
  LineChart,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
  Zap
} from "lucide-react";
import ToastNotification from "../components/ToastNotification";
import { authEnabled, sendPasswordReset } from "../firebaseClient";

function BrandLogo({ size = 24 }) {
  return (
    <span className="brand-logo-mark landing-logo" aria-hidden="true">
      <BatteryCharging size={size} strokeWidth={2.25} />
    </span>
  );
}

function Landing({ mode, onEnterApp, onShowLogin, onShowSignup, onBackHome, onAuthSubmit, authPending, authError }) {
  const isAuthMode = mode === "login" || mode === "signup";

  return (
    <div className="landing-root">
      <header className="landing-topnav">
        <div className="landing-brand">
          <BrandLogo size={24} />
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

      <main className={`landing-main ${isAuthMode ? "landing-main-auth" : "landing-main-carousel"}`}>
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
          <FullPageCarousel onEnterApp={onEnterApp} onShowLogin={onShowLogin} />
        )}
      </main>
    </div>
  );
}

const HERO_SLIDES = [
  {
    eyebrow: "Live telemetry",
    icon: Zap,
    title: "Battery analytics",
    highlight: "in real time",
    description:
      "Monitor voltage, current, temperature, SOC, and power on a live dashboard with six global charts plus custom chart builder.",
    cta: "Open dashboard"
  },
  {
    eyebrow: "Historical insights",
    icon: LineChart,
    title: "History analytics",
    highlight: "with smart filters",
    description:
      "Filter sessions by battery, date range, and charge/discharge mode. Export CSV and visualize trends without clutter.",
    cta: "Explore history"
  },
  {
    eyebrow: "Charge & discharge",
    icon: BatteryCharging,
    title: "Configurable cycles",
    highlight: "for your packs",
    description:
      "Set chemistry, voltage, and charge current—or run discharge profiles—then stream results to the dashboard instantly.",
    cta: "Get started"
  },
  {
    eyebrow: "Custom visualization",
    icon: Activity,
    title: "Build any chart",
    highlight: "from telemetry",
    description:
      "Pick X and Y axes with intelligent chart recommendations, dual-axis support, and live updates as packets arrive.",
    cta: "Try the demo"
  }
];

function FullPageCarousel({ onEnterApp, onShowLogin }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const slideCount = HERO_SLIDES.length;

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slideCount);
    }, 5500);
    return () => clearInterval(timer);
  }, [slideCount]);

  function goTo(index) {
    setActiveIndex((index + slideCount) % slideCount);
  }

  return (
    <section className="landing-carousel" aria-label="Product overview">
      <div
        className="landing-carousel-track"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {HERO_SLIDES.map((item, index) => {
          const SlideIcon = item.icon;
          return (
            <article key={item.title} className="landing-slide" aria-hidden={index !== activeIndex}>
              <div className="landing-slide-inner">
                <div className="landing-slide-copy">
                  <span className="landing-eyebrow">
                    <SlideIcon size={15} /> {item.eyebrow}
                  </span>
                  <h1>
                    {item.title}
                    <span>{item.highlight}</span>
                  </h1>
                  <p>{item.description}</p>
                  <div className="landing-slide-actions">
                    <button className="landing-btn primary large" onClick={onEnterApp} type="button">
                      {item.cta} <ArrowRight size={17} />
                    </button>
                    <button className="landing-btn ghost large" onClick={onShowLogin} type="button">
                      Sign in
                    </button>
                  </div>
                </div>
                <div className="landing-slide-visual">
                  <section className="landing-preview landing-preview-hero">
                    <div className="preview-head">
                      <strong>PowerProbe Preview</strong>
                      <span>Slide {index + 1} of {slideCount}</span>
                    </div>
                    <div className="preview-metrics">
                      <PreviewMetric icon={Zap} label="Voltage" value="12.4 V" />
                      <PreviewMetric icon={Activity} label="Current" value="2.10 A" />
                      <PreviewMetric icon={Gauge} label="SOC" value="78%" />
                    </div>
                    <div className="preview-chart">
                      <SlideIcon size={48} />
                      <div>
                        <strong>{item.eyebrow}</strong>
                        <span>{item.description}</span>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="landing-carousel-controls">
        <button
          type="button"
          className="carousel-nav-btn"
          onClick={() => goTo(activeIndex - 1)}
          aria-label="Previous slide"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="landing-carousel-dots">
          {HERO_SLIDES.map((item, idx) => (
            <button
              key={item.title}
              type="button"
              className={idx === activeIndex ? "active" : ""}
              onClick={() => goTo(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              aria-current={idx === activeIndex}
            />
          ))}
        </div>
        <button
          type="button"
          className="carousel-nav-btn"
          onClick={() => goTo(activeIndex + 1)}
          aria-label="Next slide"
        >
          <ChevronRight size={20} />
        </button>
      </div>
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
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("error");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const isSignup = mode === "signup";

  useEffect(() => {
    if (authError) {
      setToastType("error");
      setToastMessage(authError);
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

  async function handleForgotSubmit(event) {
    event.preventDefault();
    setResetPending(true);
    setToastMessage(null);
    try {
      if (!authEnabled) {
        throw new Error("Password reset is available when Firebase Auth is configured.");
      }
      await sendPasswordReset(form.email);
      setToastType("success");
      setToastMessage("Password reset email sent. Check your inbox.");
      setForgotOpen(false);
    } catch (error) {
      setToastType("error");
      setToastMessage(error instanceof Error ? error.message : "Could not send reset email.");
    } finally {
      setResetPending(false);
    }
  }

  return (
    <section className="auth-shell">
      <ToastNotification
        message={toastMessage}
        type={toastType}
        duration={5000}
        onClose={() => setToastMessage(null)}
      />
      <button className="landing-btn ghost back" onClick={onBackHome} type="button">
        <ArrowLeft size={16} /> Back
      </button>

      {forgotOpen ? (
        <form className="auth-card" onSubmit={handleForgotSubmit}>
          <div>
            <h1>Reset password</h1>
            <p>Enter your account email and we will send a reset link.</p>
          </div>
          <label>
            Email
            <span>
              <Mail size={17} />
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="user@example.com"
                required
              />
            </span>
          </label>
          <button className="landing-btn primary large" type="submit" disabled={resetPending}>
            {resetPending ? (
              <>
                <LoaderCircle size={17} className="button-spinner" />
                Sending...
              </>
            ) : (
              "Send reset link"
            )}
          </button>
          <button className="auth-switch" onClick={() => setForgotOpen(false)} type="button">
            Back to login
          </button>
        </form>
      ) : (
        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-card-brand">
            <BrandLogo size={28} />
            <div>
              <h1>{isSignup ? "Create account" : "Login"}</h1>
              <p>{isSignup ? "Create an account to enter the dashboard." : "Sign in with your email and password."}</p>
            </div>
          </div>

          {isSignup && (
            <label>
              Name
              <span>
                <UserRound size={17} />
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="User name"
                />
              </span>
            </label>
          )}

          <label>
            Email
            <span>
              <Mail size={17} />
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="user@example.com"
                required
              />
            </span>
          </label>

          <label>
            Password
            <span>
              <LockKeyhole size={17} />
              <input
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="Password"
                required
              />
            </span>
          </label>

          {!isSignup && (
            <button className="forgot-password-link" onClick={() => setForgotOpen(true)} type="button">
              Forgot password?
            </button>
          )}

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
      )}
    </section>
  );
}

export default Landing;
