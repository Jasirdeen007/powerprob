import {
  BatteryCharging,
  FileSpreadsheet,
  Gauge,
  History,
  LogOut,
  PlusCircle,
  ShieldCheck
} from "lucide-react";

function Sidebar({ activePage, onPageChange, currentUser, onLogout }) {
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
      <div className="role-card">
        <button 
          className="logout-button" 
          onClick={() => {
            if (window.confirm("Are you sure you want to sign out?")) {
              onLogout();
            }
          }} 
          type="button"
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
