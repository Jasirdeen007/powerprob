import { useState } from "react";
import {
  BatteryCharging,
  LogOut,
  Menu,
  X,
  User,
  Settings
} from "lucide-react";

function Header({ activePage, onPageChange, currentUser, onLogout, theme, onToggleTheme }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const items = [
    { key: "dashboard", label: "Dashboard" },
    { key: "traceability", label: "History Analytics" }
  ];

  const handlePageChange = (key) => {
    onPageChange(key);
    setMobileMenuOpen(false);
  };

  return (
    <header className="header-top">
      <div className="header-container" style={{ justifyContent: "center", position: "relative" }}>
        {/* Left: Logo and Brand */}
        <div className="header-brand" style={{ position: "absolute", left: "24px" }}>
          <BatteryCharging size={24} />
          <div className="brand-text">
            <strong>PowerProbe</strong>
            <span>BMS Dashboard</span>
          </div>
        </div>

        {/* Center: Navigation (Desktop) */}
        <nav className="header-nav desktop-only">
          {items.map(({ key, label }) => (
            <button
              key={key}
              className={`nav-item ${activePage === key ? "active" : ""}`}
              disabled={!currentUser?.access?.includes(key)}
              onClick={() => handlePageChange(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right: Profile and Settings */}
        <div className="header-actions" style={{ position: "absolute", right: "24px" }}>
          {/* Live Status Indicator */}
          <div className="live-status">
            <span className="status-dot"></span>
            <span className="status-text">LIVE</span>
          </div>

          {/* Profile Menu */}
          <div className="profile-menu">
            <button
              className="profile-button"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              title="Profile"
            >
              <User size={20} />
            </button>

            {profileMenuOpen && (
              <div className="profile-dropdown">
                <div className="profile-header">
                  <User size={16} />
                  <span>{currentUser?.name || currentUser?.email || "User"}</span>
                </div>
                <div className="profile-details">
                  <p className="detail-label">Email</p>
                  <p className="detail-value">{currentUser?.email || "N/A"}</p>
                </div>
                <div className="profile-divider"></div>
                <button
                  className="profile-option"
                  onClick={onToggleTheme}
                >
                  {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
                </button>
                <button
                  className="profile-option logout"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to sign out?")) {
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

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-toggle mobile-only"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <nav className="header-mobile-menu">
          {items.map(({ key, label }) => (
            <button
              key={key}
              className={`mobile-nav-item ${activePage === key ? "active" : ""}`}
              disabled={!currentUser?.access?.includes(key)}
              onClick={() => handlePageChange(key)}
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
