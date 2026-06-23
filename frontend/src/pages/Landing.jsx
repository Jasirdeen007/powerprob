import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  ChevronLeft,
  ChevronRight,
  Chrome,
  Gauge,
  LineChart,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  UserRound,
  Zap
} from "lucide-react";
import ToastNotification from "../components/ToastNotification";
import PasswordStrengthIndicator from "../components/PasswordStrengthIndicator";
import FormFieldError from "../components/FormFieldError";
import { authEnabled, googleLogin, sendPasswordReset } from "../firebaseClient";

const RECENT_EMAILS_KEY = "powerprobe_recent_emails";

function readRecentEmails() {
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_EMAILS_KEY) ?? "[]").filter(Boolean);
  } catch {
    return [];
  }
}

function saveRecentEmail(email) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];
  const next = [normalized, ...readRecentEmails().filter((item) => item !== normalized)].slice(0, 6);
  window.localStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(next));
  return next;
}

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
      <footer className="landing-footer">
        <span>PowerProbe</span>
        <a href="#" onClick={(e) => e.preventDefault()}>About PowerProbe</a>
        <span>Version 0.1.0</span>
      </footer>
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
  const [isInteracting, setIsInteracting] = useState(false);
  const slideCount = HERO_SLIDES.length;

  useEffect(() => {
    if (isInteracting) return undefined;
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slideCount);
    }, 8000);
    return () => clearInterval(timer);
  }, [isInteracting, slideCount]);

  function goTo(index) {
    setActiveIndex((index + slideCount) % slideCount);
    setIsInteracting(true);
    window.setTimeout(() => setIsInteracting(false), 9000);
  }

  return (
    <section
      className="landing-carousel"
      aria-label="Product overview"
      onPointerDown={() => setIsInteracting(true)}
      onPointerLeave={() => setIsInteracting(false)}
      onPointerUp={() => window.setTimeout(() => setIsInteracting(false), 3000)}
    >
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
  const [recentEmails, setRecentEmails] = useState(readRecentEmails);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("error");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ name: "", email: "", password: "" });
  const [touchedFields, setTouchedFields] = useState({ name: false, email: false, password: false });
  const isSignup = mode === "signup";

  useEffect(() => {
    if (authError) {
      setToastType("error");
      setToastMessage(authError);
    }
  }, [authError]);

  function sanitizeInput(value) {
    return String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
  }

  function sanitizePassword(value) {
    return String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  }

  function validateField(field, value) {
    switch (field) {
      case "name":
        if (isSignup && !value.trim()) return "Please enter your name";
        return "";
      case "email": {
        if (!value.trim()) return "Email is required";
        const trimmed = value.trim();
        if (/\s/.test(trimmed)) return "Email must not contain spaces";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Please enter a valid email address";
        const domain = trimmed.split("@")[1];
        if (domain && domain.split(".").some(part => part.length === 0)) return "Please enter a valid email address";
        return "";
      }
      case "password": {
        if (!value) return "Password is required";
        if (isSignup) {
          if (value.length < 8) return "Password must be at least 8 characters";
          if (!/[A-Z]/.test(value)) return "Password must contain an uppercase letter";
          if (!/[a-z]/.test(value)) return "Password must contain a lowercase letter";
          if (!/[0-9]/.test(value)) return "Password must contain a number";
          if (!/[^A-Za-z0-9]/.test(value)) return "Password must contain a special character";
        } else {
          if (value.length < 6) return "Password must be at least 6 characters";
        }
        return "";
      }
      default:
        return "";
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (touchedFields[field]) {
      setFieldErrors((current) => ({ ...current, [field]: validateField(field, value) }));
    }
  }

  function handleBlur(field) {
    setTouchedFields((current) => ({ ...current, [field]: true }));
    setFieldErrors((current) => ({ ...current, [field]: validateField(field, form[field]) }));
  }

  function handleGoogleLogin() {
    onAuthSubmit({ mode: "google" });
  }

  function handleSubmit(event) {
    event.preventDefault();
    
    const nameError = validateField("name", form.name);
    const emailError = validateField("email", form.email);
    const passwordError = validateField("password", form.password);
    
    setFieldErrors({
      name: nameError,
      email: emailError,
      password: passwordError
    });
    setTouchedFields({
      name: true,
      email: true,
      password: true
    });
    
    if (nameError || emailError || passwordError) {
      return;
    }
    
    const sanitizedEmail = sanitizeInput(form.email);
    const sanitizedPassword = sanitizePassword(form.password);
    const sanitizedName = sanitizeInput(form.name);
    const fallbackName = sanitizedEmail ? sanitizedEmail.split("@")[0] : "Battery Test User";
    
    setRecentEmails(saveRecentEmail(sanitizedEmail));
    onAuthSubmit({
      mode: isSignup ? "signup" : "login",
      name: isSignup ? sanitizedName || fallbackName : fallbackName,
      email: sanitizedEmail,
      password: sanitizedPassword,
      role: "User"
    });
  }

  const emailPrefix = form.email.trim();
  const emailSuggestions = [
    ...recentEmails,
    ...(emailPrefix && !emailPrefix.includes("@") ? [`${emailPrefix}@gmail.com`] : [])
  ].filter((email, index, list) => email && list.indexOf(email) === index);

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
      setToastMessage("If an account with that email exists, a reset link has been sent.");
      setForgotOpen(false);
    } catch (error) {
      setToastType("success");
      setToastMessage("If an account with that email exists, a reset link has been sent.");
      setForgotOpen(false);
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
      <datalist id="powerprobe-email-suggestions">
        {emailSuggestions.map((email) => (
          <option key={email} value={email} />
        ))}
      </datalist>
      <button className="landing-btn ghost back" onClick={onBackHome} type="button">
        <ArrowLeft size={16} /> Back
      </button>

      {forgotOpen ? (
        <form className="auth-card" onSubmit={handleForgotSubmit} aria-label="Reset password">
          <div>
            <h1 id="forgot-password-title">Reset password</h1>
            <p id="forgot-password-description">Enter your account email and we will send a reset link.</p>
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
                list="powerprobe-email-suggestions"
                autoComplete="username email"
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
        <form className="auth-card" onSubmit={handleSubmit} aria-label={isSignup ? "Create account" : "Sign in"}>
          <div className="auth-card-brand">
            <BrandLogo size={28} />
            <div>
              <h1 id="auth-title">{isSignup ? "Create account" : "Login"}</h1>
              <p id="auth-description">{isSignup ? "Create an account to enter the dashboard." : "Sign in with your email and password."}</p>
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
                  onBlur={() => handleBlur("name")}
                  placeholder="User name"
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                />
              </span>
              <FormFieldError error={fieldErrors.name} id="name-error" />
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
                onBlur={() => handleBlur("email")}
                placeholder="user@example.com"
                list="powerprobe-email-suggestions"
                autoComplete="username email"
                required
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
            </span>
            <FormFieldError error={fieldErrors.email} id="email-error" />
          </label>
          <label>
            Password
            <span className="password-input-wrap">
              <LockKeyhole size={17} />
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                onBlur={() => handleBlur("password")}
                placeholder="Password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={isSignup ? 8 : 6}
                required
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
              />
              <button
                className="password-eye-button"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
            <FormFieldError error={fieldErrors.password} id="password-error" />
          </label>
          
          {isSignup && (
            <PasswordStrengthIndicator password={form.password} showRules={true} />
          )}

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

          {authEnabled && (
            <>
              <div className="auth-divider">
                <span>or</span>
              </div>

              <button 
                className="auth-google-btn" 
                type="button" 
                onClick={handleGoogleLogin}
                disabled={authPending}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <button className="auth-switch" onClick={onSwitchMode} type="button">
            {isSignup ? "Already have an account? Login" : "New here? Create account"}
          </button>
        </form>
      )}
    </section>
  );
}

export default Landing;
