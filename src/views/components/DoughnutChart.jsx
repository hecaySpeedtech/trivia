import { useEffect, useRef } from "react";
import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from "chart.js";
Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

export default function DoughnutChart({ data, labels }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (!ref.current) return;
    chartRef.current = new Chart(ref.current, {
      type: "doughnut",
      data: { labels, datasets: [{ data, backgroundColor: ["#1e90ff", "#f59e0b", "#ef4444"] }] },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [data, labels]);
  return <canvas ref={ref} />;
}