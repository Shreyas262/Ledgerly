import { Stack, Typography } from "@mui/material";

import type { DashboardExpenseTypeSpending } from "../types/dashboard";
import { EXPENSE_TYPE_LABELS } from "../../expenses/types/expense";
import { Amount } from "../../../components/common/Amount";
import { ChartCard } from "../../../components/common/ChartCard";

interface CategoryAnalysisProps {
  data: DashboardExpenseTypeSpending[];
}

export function CategoryAnalysis({
  data,
}: CategoryAnalysisProps) {
  const maxAmount = Math.max(
    ...data.map((item) => item.amount),
    0,
  );

  return (
    <ChartCard
      title="Spending by Expense Type"
      subtitle="Breakdown of expenses by expense type"
      isEmpty={data.length === 0}
      emptyMessage="There are no expenses in the selected date range."
      minHeight={220}
    >
      <Stack spacing={2}>
        {data.map((item) => {
          const percentage =
            maxAmount > 0
              ? (item.amount / maxAmount) * 100
              : 0;

          return (
            <Stack
              key={item.expenseType}
              spacing={1}
            >
              <Stack
                direction="row"
                sx={{
                  gap: 2,
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="body2">
                  {EXPENSE_TYPE_LABELS[item.expenseType] ?? item.expenseType}
                </Typography>

                <Typography variant="subtitle2">
                  <Amount value={item.amount} />
                </Typography>
              </Stack>

              <Stack
                sx={{
                  height: 8,
                  borderRadius: 1,
                  bgcolor: "chart.track",
                  overflow: "hidden",
                }}
              >
                <Stack
                  sx={{
                    width: `${percentage}%`,
                    height: "100%",
                    bgcolor: "chart.series",
                  }}
                />
              </Stack>
            </Stack>
          );
        })}
      </Stack>
    </ChartCard>
  );
}
