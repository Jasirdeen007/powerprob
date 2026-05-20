function MetricCard({ icon: Icon, label, value, detail, tone = "neutral" }) {
  return (
    <section className={`metric ${tone}`}>
      <div className="metric-icon"><Icon size={20} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </section>
  );
}

export default MetricCard;
