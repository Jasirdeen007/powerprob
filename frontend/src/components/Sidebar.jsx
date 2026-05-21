import {
  BatteryCharging,
  FileSpreadsheet,
  Gauge,
  History,
  LogOut,
  Moon,
  Sun
} from "lucide-react";

function Sidebar({ activePage, onPageChange, currentUser, onLogout, theme, onToggleTheme }) {
  const items = [
    ["dashboard", Gauge, "Dashboard"],
    ["traceability", History, "History Analytics"]
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <BatteryCharging size={28} />
        <div>
          <strong>PowerProbe</strong>
          <span>Battery Analytics</span>
        </div>
      </div>
      <nav>
        {items.map(([key, Icon, label]) => (
          <button
            key={key}
            className={activePage === key ? "active" : ""}
            disabled={!currentUser.access.includes(key)}
            onClick={() => onPageChange(key)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
      <nav style={{ marginTop: "auto" }}>
        <button 
          onClick={onToggleTheme} 
          type="button"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button 
          onClick={() => {
            if (window.confirm("Are you sure you want to sign out?")) {
              onLogout();
            }
          }} 
          type="button"
        >
          <LogOut size={18} /> Logout
        </button>
      </nav>
    </aside>
  );
}

export default Sidebar;
