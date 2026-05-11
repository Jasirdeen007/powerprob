function LineChart({ data, series, height = 180 }) {
  const width = 720;
  const padding = 28;
  const values = data.map((item) => item[series.key]).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = data
    .map((item, index) => {
      const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((item[series.key] - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.label}>
      <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
      <line x1={padding} x2={padding} y1={padding} y2={height - padding} />
      <polyline points={points} style={{ stroke: series.color }} />
      <text x={padding} y={18}>{max.toFixed(series.precision ?? 1)} {series.unit}</text>
      <text x={padding} y={height - 5}>{min.toFixed(series.precision ?? 1)} {series.unit}</text>
    </svg>
  );
}

export default LineChart;
