function StatCard({ label, value, unit = "", trend = null, icon: Icon = null }) {
  const capitalize = (s) => (typeof s === "string" && s.length ? s[0].toUpperCase() + s.slice(1) : s);
  return (
    <div className="stat-card">
      <div className="stat-header">
        {Icon && <Icon size={20} style={{ color: "#64748b" }} />}
        <span className="stat-label">{capitalize(label)}</span>
      </div>
      <div className="stat-content">
        <strong className="stat-value">
          {typeof value === "number" ? value.toFixed(2) : value}
          {unit && <span className="stat-unit">{unit}</span>}
        </strong>
        {trend && (
          <span className={`stat-trend ${trend > 0 ? "positive" : "negative"}`}>
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

export default StatCard;
