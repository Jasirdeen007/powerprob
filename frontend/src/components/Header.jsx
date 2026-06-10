import { useEffect, useRef, useState } from "react";
import { BatteryCharging, LogOut, Menu, Moon, Sun, User, X } from "lucide-react";
import { getAppInfo } from "../backendClient";

function BrandLogo({ size = 22 }) {
  return (
    <span className="brand-logo-mark" aria-hidden="true">
      <BatteryCharging size={size} strokeWidth={2.5} color="#ffffff" />
    </span>
  );
}

function Header({ activePage, onPageChange, currentUser, onLogout, theme, onToggleTheme }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appInfo, setAppInfo] = useState(null);
  const profileRef = useRef(null);

  const items = [
    { key: "dashboard", label: "Dashboard" },
    { key: "traceability", label: "History Analytics" }
  ];

  function openAbout() {
    setAboutOpen(true);
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
  }

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    function onPointerDown(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setProfileMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!aboutOpen || appInfo) return undefined;
    let cancelled = false;
    getAppInfo()
      .then((info) => {
        if (!cancelled) setAppInfo(info);
      })
      .catch(() => {
        if (!cancelled) {
          setAppInfo({
            name: "PowerProbe",
            version: "0.1.0",
            credits: ["PowerProbe Team 6"],
            manual: "frontend/docs/README.md"
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [aboutOpen, appInfo]);

  return (
    <header className="header-top">
      <div className="header-container">
        <div className="header-brand">
          <BrandLogo />
          <div className="brand-text">
            <strong className="brand-name">PowerProbe</strong>
          </div>
        </div>

        <nav className="header-nav desktop-only">
          {items.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`nav-item ${activePage === key ? "active" : ""}`}
              disabled={!currentUser?.access?.includes(key)}
              onClick={() => { onPageChange(key); setMobileMenuOpen(false); }}
            >
              {label}
            </button>
          ))}
          <a className="nav-item nav-link-item" href="/help.html" target="_blank" rel="noreferrer">
            Help Documentation
          </a>
          <button type="button" className="nav-item nav-link-item" onClick={openAbout}>
            About PowerProbe
          </button>
        </nav>

        <div className="header-actions">
          <button type="button" className="header-theme-toggle" onClick={onToggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>

          <div className="header-profile-menu" ref={profileRef}>
            <button
              type="button"
              className="profile-button"
              onClick={() => setProfileMenuOpen((o) => !o)}
              aria-expanded={profileMenuOpen}
            >
              <User size={18} />
            </button>

            {profileMenuOpen && (
              <div className="header-profile-dropdown">
                <div className="header-profile-user">
                  <div className="header-profile-avatar">
                    <User size={18} />
                  </div>
                  <div>
                    <strong>{currentUser?.name || "User"}</strong>
                    <span>{currentUser?.email || "No email"}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="header-profile-action logout"
                  onClick={() => {
                    if (window.confirm("Sign out?")) {
                      onLogout();
                      setProfileMenuOpen(false);
                    }
                  }}
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>

          <button type="button" className="mobile-menu-toggle mobile-only" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="header-mobile-menu">
          {items.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`mobile-nav-item ${activePage === key ? "active" : ""}`}
              disabled={!currentUser?.access?.includes(key)}
              onClick={() => { onPageChange(key); setMobileMenuOpen(false); }}
            >
              {label}
            </button>
          ))}
          <a className="mobile-nav-item" href="/help.html" target="_blank" rel="noreferrer" onClick={() => setMobileMenuOpen(false)}>
            Help Documentation
          </a>
          <button type="button" className="mobile-nav-item" onClick={openAbout}>
            About PowerProbe
          </button>
          <button type="button" className="mobile-nav-item" onClick={onToggleTheme}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </nav>
      )}

      {aboutOpen && (
        <div className="about-modal-backdrop" role="presentation" onMouseDown={() => setAboutOpen(false)}>
          <section
            className="about-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-powerprobe-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="about-modal-close" type="button" onClick={() => setAboutOpen(false)} aria-label="Close about dialog">
              <X size={18} />
            </button>
            <div className="about-modal-mark">
              <BrandLogo size={24} />
            </div>
            <h2 id="about-powerprobe-title">About {appInfo?.name ?? "PowerProbe"}</h2>
            <p>Version {appInfo?.version ?? "loading"}</p>
            <div className="about-modal-credits">
              {(appInfo?.credits ?? ["Loading credits..."]).map((credit) => (
                <span key={credit}>{credit}</span>
              ))}
            </div>
          </section>
        </div>
      )}
    </header>
  );
}

export default Header;
