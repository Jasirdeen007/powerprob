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
  const profileRef = useRef(null);

  const items = [
    { key: "dashboard", label: "Dashboard" },
    { key: "traceability", label: "History Analytics" }
  ];
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
        </nav>

        <div className="header-actions">
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
                <button type="button" className="header-profile-action" onClick={onToggleTheme}>
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
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
        </nav>
      )}
    </header>
  );
}

export default Header;
