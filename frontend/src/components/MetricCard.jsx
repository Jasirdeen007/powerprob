function MetricCard({ icon: Icon, label, value, detail, tone = "neutral" }) {
  const capitalize = (s) => (typeof s === "string" && s.length ? s[0].toUpperCase() + s.slice(1) : s);
  return (
    <section className={`metric ${tone}`}>
      <div className="metric-icon"><Icon size={20} /></div>
      <div>
        <p>{capitalize(label)}</p>
        <strong>{value}</strong>
        <span>{capitalize(detail)}</span>
      </div>
    </section>
  );
}

export default MetricCard;
