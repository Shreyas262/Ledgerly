import { Stack, Typography } from "@mui/material";

import type { DimensionSpending } from "../utils/calculateDimensionSpending";
import { Amount } from "../../../components/common/Amount";
import { ChartCard } from "../../../components/common/ChartCard";

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
    <ChartCard
      title={title}
      subtitle={description}
      isEmpty={data.length === 0}
      emptyMessage={emptyMessage}
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
