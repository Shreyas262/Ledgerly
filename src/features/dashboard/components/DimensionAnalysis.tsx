import {
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";

import type { DimensionSpending } from "../utils/calculateDimensionSpending";
import { ChartState } from "./ChartState";

interface DimensionAnalysisProps {
  title: string;
  description: string;
  data: DimensionSpending[];
  emptyMessage: string;
}

export function DimensionAnalysis({
  title,
  description,
  data,
  emptyMessage,
}: DimensionAnalysisProps) {
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
              {title}
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
            >
              {description}
            </Typography>
          </Stack>

          {data.length === 0 ? (
            <ChartState
                title="No data available"
                message={emptyMessage}
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
                    key={item.name}
                    spacing={1}
                  >
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: "space-between",
                        gap: 2,
                      }}
                    >
                      <Typography variant="body2">
                        {item.name}
                      </Typography>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        ₹
                        {item.amount.toLocaleString(
                          "en-IN",
                        )}
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