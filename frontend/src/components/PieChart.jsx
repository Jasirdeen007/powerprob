function PieChart({ data, height = 200, width = 200 }) {
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);
  if (total === 0) return <div className="pie-chart-empty">No data</div>;

  const colors = {
    CHARGE: "#246bfe",
    DISCHARGE: "#f97316",
    IDLE: "#94a3b8"
  };

  let currentAngle = -Math.PI / 2;
  const slices = [];

  Object.entries(data).forEach(([mode, count]) => {
    const sliceAngle = (count / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(height, width) / 2 - 10;

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    slices.push({
      mode,
      count,
      percentage: ((count / total) * 100).toFixed(1),
      path: pathData,
      color: colors[mode] || "#cbd5e1"
    });

    currentAngle = endAngle;
  });

  return (
    <svg className="pie-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mode distribution">
      {slices.map((slice) => (
        <path
          key={slice.mode}
          d={slice.path}
          fill={slice.color}
          stroke="#ffffff"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

export default PieChart;
