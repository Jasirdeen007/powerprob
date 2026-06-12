import { useEffect, useRef, useState } from "react";
import { BatteryCharging, LogOut, Menu, Moon, Sun, User, X } from "lucide-react";

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
  const [helpOpen, setHelpOpen] = useState(false);
  const profileRef = useRef(null);

  const items = [
    { key: "dashboard", label: "Dashboard" },
    { key: "traceability", label: "History Analytics" }
  ];

  function openHelp() {
    setHelpOpen(true);
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
    function onMessage(event) {
      if (event.data?.type === "powerprobe:close-help") {
        setHelpOpen(false);
      }
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

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
          <button type="button" className="nav-item nav-link-item" onClick={openHelp}>
            Help Documentation
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
          <button type="button" className="mobile-nav-item" onClick={openHelp}>
            Help Documentation
          </button>
          <button type="button" className="mobile-nav-item" onClick={onToggleTheme}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </nav>
      )}

      {helpOpen && (
        <div className="about-modal-backdrop help-modal-backdrop" role="presentation" onMouseDown={() => setHelpOpen(false)}>
          <section
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="powerprobe-help-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="about-modal-close" type="button" onClick={() => setHelpOpen(false)} aria-label="Close help documentation">
              <X size={18} />
            </button>
            <h2 id="powerprobe-help-title" className="sr-only">PowerProbe Help Documentation</h2>
            <iframe className="help-modal-frame" src="/help.html" title="PowerProbe Help Documentation" />
          </section>
        </div>
      )}
    </header>
  );
}

export default Header;
