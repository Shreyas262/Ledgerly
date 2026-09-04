import {
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";

import type { CategorySpending } from "../utils/calculateCategorySpending";
import { ChartState } from "./ChartState";

interface CategoryAnalysisProps {
  data: CategorySpending[];
}

export function CategoryAnalysis({
  data,
}: CategoryAnalysisProps) {
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
              Spending by Category
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
            >
              Breakdown of expenses by category
            </Typography>
          </Stack>

          {data.length === 0 ? (
            <ChartState
              title="No category data"
              message="There are no categorized expenses in the selected date range."
            />
          ) : (
            <Stack spacing={2}>
              {data.map((item) => {
                const percentage =
                  maxAmount > 0
                    ? (item.amount / maxAmount) * 100
                    : 0;

                return (
                  <Stack
                    key={item.category}
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
                        {item.category}
                      </Typography>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        ₹{item.amount.toLocaleString("en-IN")}
                      </Typography>
                    </Stack>

                    <Stack
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        bgcolor: "action.hover",
                        overflow: "hidden",
                      }}
                    >
                      <Stack
                        sx={{
                          width: `${percentage}%`,
                          height: "100%",
                          bgcolor: "primary.main",
                        }}
                      />
                    </Stack>
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