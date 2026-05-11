import LineChart from "./LineChart";

function ChartBlock({ title, data, series }) {
  return (
    <div className="chart-block">
      <h3>{title}</h3>
      <LineChart data={data} series={series} />
    </div>
  );
}

export default ChartBlock;
