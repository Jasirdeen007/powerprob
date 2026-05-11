import {
  BatteryCharging,
  FileSpreadsheet,
  Gauge,
  History,
  PlusCircle,
  ShieldCheck
} from "lucide-react";

function Sidebar({ activePage, onPageChange, currentUser, onLogout }) {
  const items = [
    ["dashboard", Gauge, "Dashboard"],
    ["entry", PlusCircle, "Battery Entry"],
    ["profiles", ShieldCheck, "Drone Profiles"],
    ["traceability", History, "Traceability"],
    ["reports", FileSpreadsheet, "Reports"]
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
        <span>{currentUser.name}</span>
        <strong>{currentUser.role}</strong>
        <button className="logout-button" onClick={onLogout} type="button">Logout</button>
      </div>
    </aside>
  );
}

export default Sidebar;
