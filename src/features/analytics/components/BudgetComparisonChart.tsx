import { Stack, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import type { AnalyticsBudgetComparison } from "../types/analytics";
import { ChartCard } from "../../../components/common/ChartCard";
import { formatChartCurrency, formatCompactCurrency } from "../utils/chartFormat";
import { useChartColors } from "../utils/chartColors";
import { formatDate } from "../utils/analyticsFilters";

const LEVEL_LABEL: Record<AnalyticsBudgetComparison["level"], string> = {
  DEPARTMENT: "department",
  TEAM: "team",
  EXPENSE_TYPE: "team and expense type",
};

interface BudgetComparisonChartProps {
  comparison: AnalyticsBudgetComparison | null;
}

export function BudgetComparisonChart({ comparison }: BudgetComparisonChartProps) {
  const colors = useChartColors();
  const rows = comparison?.rows ?? [];
  const overBudget = rows.filter((row) => row.allocated > 0 && row.spent > row.allocated);
  const height = rows.length * 56 + 72;
  const percent = (spent: number, allocated: number) => {
    const value = allocated ? (spent / allocated) * 100 : 0;
    return value > 0 && value < 10 ? value.toFixed(1) : Math.round(value).toString();
  };
  const labels = rows.map((row) => `${row.name} · ${percent(row.spent, row.allocated)}%`);

  return (
    <ChartCard
      title="Budget vs actual"
      subtitle={comparison
        ? `${comparison.budgetName} · ${formatDate(comparison.startDate)} – ${formatDate(comparison.endDate)} · by ${LEVEL_LABEL[comparison.level]} · whole budget period`
        : "Allocation against reimbursed spend"}
      isEmpty={rows.length === 0}
      emptyMessage={comparison
        ? `No ${LEVEL_LABEL[comparison.level]} allocations in the active budget.`
        : "There is no active budget for the current period."}
      minHeight={128}
    >
      <Stack spacing={1}>
        {overBudget.length > 0 && (
          <Typography variant="body2" color="error">
            Over budget: {overBudget.map((row) => row.name).join(", ")}
          </Typography>
        )}
        <BarChart
          height={height}
          layout="horizontal"
          yAxis={[{ scaleType: "band", data: labels, width: 180 }]}
          xAxis={[{ valueFormatter: formatCompactCurrency }]}
          series={[
            { label: "Allocated", data: rows.map((row) => row.allocated), color: colors.reference, valueFormatter: formatChartCurrency },
            { label: "Reimbursed", data: rows.map((row) => row.spent), color: colors.series, valueFormatter: formatChartCurrency },
          ]}
          grid={{ vertical: true }}
          borderRadius={4}
          margin={{ top: 8, right: 24 }}
        />
      </Stack>
    </ChartCard>
  );
}
