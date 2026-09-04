import {
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";

import type { MonthlySpending } from "../utils/calculateMonthlySpending";
import { ChartState } from "./ChartState";

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
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Stack spacing={0.5}>
            <Typography variant="h6">
              Spending Trend
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
            >
              Monthly expense spending
            </Typography>
          </Stack>

          {data.length === 0 ? (
            <ChartState
              title="No spending data"
              message="There are no expenses in the selected date range."
            />
          ) : (
            <Stack
              direction="row"
              spacing={2}
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
                      width: 80,
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
                      ₹{item.amount.toLocaleString("en-IN")}
                    </Typography>

                    <Stack
                      sx={{
                        width: 40,
                        height,
                        minHeight: 4,
                        borderRadius: 1,
                        bgcolor: "primary.main",
                      }}
                    />

                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      {item.month}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}