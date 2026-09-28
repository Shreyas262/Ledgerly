import { useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import type { AnalyticsInterval, AnalyticsSpendingPoint } from "../types/analytics";
import { EXPENSE_TYPE_LABELS, EXPENSE_TYPES } from "../../expenses/types/expense";
import { ChartCard } from "../../../components/common/ChartCard";
import { formatChartCurrency, formatCompactCurrency } from "../utils/chartFormat";
import { useChartColors } from "../utils/chartColors";
import { formatPeriod } from "../utils/analyticsFilters";

interface SpendingTrendChartProps {
  data: AnalyticsSpendingPoint[];
  interval: AnalyticsInterval;
}

const INTERVAL_LABEL: Record<AnalyticsInterval, string> = { DAY: "day", WEEK: "week", MONTH: "month" };

export function SpendingTrendChart({ data, interval }: SpendingTrendChartProps) {
  const colors = useChartColors();
  const [mode, setMode] = useState<"total" | "type">("total");
  const labels = data.map((point) => formatPeriod(point.period, interval));
  const typesPresent = EXPENSE_TYPES.filter((type) => data.some((point) => point.byType[type]));
  const isEmpty = data.every((point) => point.amount === 0);

  const series = mode === "total"
    ? [{
        id: "total",
        label: "Spend",
        data: data.map((point) => point.amount),
        area: true,
        showMark: data.length <= 16,
        curve: "monotoneX" as const,
        color: colors.series,
        valueFormatter: formatChartCurrency,
      }]
    : typesPresent.map((type) => ({
        id: type,
        label: EXPENSE_TYPE_LABELS[type],
        data: data.map((point) => point.byType[type] ?? 0),
        stack: "types",
        area: true,
        showMark: false,
        curve: "monotoneX" as const,
        color: colors.expenseType(type),
        valueFormatter: formatChartCurrency,
      }));

  return (
    <ChartCard
      title="Spending trend"
      subtitle={`Spend per ${INTERVAL_LABEL[interval]}`}
      isEmpty={isEmpty}
      emptyMessage="No spend in the selected period."
      minHeight={320}
      action={
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_event, value) => value && setMode(value)}
          aria-label="Trend breakdown"
        >
          <ToggleButton value="total">Total</ToggleButton>
          <ToggleButton value="type">By type</ToggleButton>
        </ToggleButtonGroup>
      }
    >
      <LineChart
        height={320}
        series={series}
        xAxis={[{ scaleType: "point", data: labels }]}
        yAxis={[{ valueFormatter: formatCompactCurrency, width: 64 }]}
        grid={{ horizontal: true }}
        hideLegend={mode === "total"}
        margin={{ top: 16, right: 28 }}
      />
    </ChartCard>
  );
}
