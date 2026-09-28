import { Stack, Typography } from "@mui/material";

import type { DashboardSpendingPoint as MonthlySpending } from "../types/dashboard";
import { Amount } from "../../../components/common/Amount";
import { ChartCard } from "../../../components/common/ChartCard";

interface SpendingTrendProps {
  data: MonthlySpending[];
}

export function SpendingTrend({
  data,
}: SpendingTrendProps) {
  const maxAmount = Math.max(
    ...data.map((item) => item.amount),
    0,
  );

  return (
    <ChartCard
      title="Spending trend"
      subtitle="Spend per month"
      isEmpty={data.length === 0}
      emptyMessage="No spend in the selected date range."
      minHeight={220}
    >
      <Stack
        direction="row"
        sx={{
          minHeight: 280,
          overflowX: "auto",
          pb: 1,
          alignItems: "flex-end",
        }}
      >
        {data.map((item) => {
          const height =
            maxAmount > 0
              ? (item.amount / maxAmount) * 220
              : 0;

          return (
            <Stack
              key={item.month}
              spacing={1}
              sx={{
                width: 96,
                height: 250,
                justifyContent: "flex-end",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
              >
                <Amount value={item.amount} />
              </Typography>

              <Stack
                sx={{
                  width: 40,
                  height,
                  minHeight: 4,
                  borderRadius: 1,
                  bgcolor: "chart.series",
                }}
              />

              {/* Month labels share a continuous baseline under the bars. */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  alignSelf: "stretch",
                  textAlign: "center",
                  pt: 0.5,
                  borderTop: 1,
                  borderColor: "divider",
                }}
              >
                {item.month}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </ChartCard>
  );
}
