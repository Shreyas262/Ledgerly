import { Box, Stack, Typography } from "@mui/material";
import { PieChart } from "@mui/x-charts/PieChart";
import type { ExpenseType } from "../../expenses/types/expense";
import { EXPENSE_TYPE_LABELS } from "../../expenses/types/expense";
import { formatCurrency } from "../../../utils/currency";
import { ChartCard } from "../../../components/common/ChartCard";
import { Amount } from "../../../components/common/Amount";
import { useChartColors } from "../utils/chartColors";

interface ExpenseTypeDonutProps {
  data: Array<{ expenseType: ExpenseType; amount: number; count: number }>;
}

export function ExpenseTypeDonut({ data }: ExpenseTypeDonutProps) {
  const colors = useChartColors();
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <ChartCard
      title="Spending by expense type"
      subtitle="Share of reimbursed spend"
      isEmpty={data.length === 0}
      emptyMessage="No reimbursed spending in the selected period."
    >
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <Box sx={{ position: "relative", width: 220, height: 220, flexShrink: 0 }}>
          <PieChart
            width={220}
            height={220}
            hideLegend
            margin={0}
            series={[{
              data: data.map((item) => ({
                id: item.expenseType,
                value: item.amount,
                label: EXPENSE_TYPE_LABELS[item.expenseType],
                color: colors.expenseType(item.expenseType),
              })),
              innerRadius: 70,
              outerRadius: 105,
              paddingAngle: 2,
              cornerRadius: 4,
              valueFormatter: (item) => formatCurrency(item.value),
            }]}
          />
          <Stack sx={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <Typography variant="caption" color="text.secondary">Total</Typography>
            <Typography variant="subtitle1"><Amount value={total} /></Typography>
          </Stack>
        </Box>
        <Stack spacing={1} sx={{ flex: 1, width: "100%", minWidth: 0 }}>
          {data.map((item) => (
            <Stack key={item.expenseType} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: colors.expenseType(item.expenseType), flexShrink: 0 }} />
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                {EXPENSE_TYPE_LABELS[item.expenseType]}
                <Typography component="span" variant="caption" color="text.secondary"> · {item.count}</Typography>
              </Typography>
              <Typography variant="subtitle2"><Amount value={item.amount} /></Typography>
              <Typography variant="caption" color="text.secondary" sx={{ width: 40, textAlign: "right" }}>
                {total ? `${((item.amount / total) * 100).toFixed(0)}%` : "0%"}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </ChartCard>
  );
}
