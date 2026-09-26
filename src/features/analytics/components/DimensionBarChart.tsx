import { BarChart } from "@mui/x-charts/BarChart";
import type { AnalyticsDimensionSpending } from "../types/analytics";
import { ChartCard } from "../../../components/common/ChartCard";
import { formatChartCurrency, formatCompactCurrency } from "../utils/chartFormat";
import { useChartColors } from "../utils/chartColors";

interface DimensionBarChartProps {
  title: string;
  subtitle: string;
  data: AnalyticsDimensionSpending[];
  emptyMessage: string;
}

const MAX_BARS = 10;

export function DimensionBarChart({ title, subtitle, data, emptyMessage }: DimensionBarChartProps) {
  const { series } = useChartColors();
  const rows = data.slice(0, MAX_BARS);
  const height = rows.length * 48 + 56;

  return (
    <ChartCard
      title={title}
      subtitle={data.length > MAX_BARS ? `${subtitle} · top ${MAX_BARS} of ${data.length}` : subtitle}
      isEmpty={rows.length === 0}
      emptyMessage={emptyMessage}
      minHeight={104}
    >
      <BarChart
        height={height}
        layout="horizontal"
        yAxis={[{ scaleType: "band", data: rows.map((row) => row.dimensionName), width: 120 }]}
        xAxis={[{ valueFormatter: formatCompactCurrency }]}
        series={[{ data: rows.map((row) => row.amount), color: series, label: "Reimbursed spend", valueFormatter: formatChartCurrency }]}
        grid={{ vertical: true }}
        hideLegend
        borderRadius={6}
        margin={{ top: 8, right: 24 }}
      />
    </ChartCard>
  );
}
