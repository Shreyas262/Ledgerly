import { LinearProgress, Stack, Typography } from "@mui/material";

import type { ApprovalMetrics as ApprovalMetricsData } from "../utils/calculateApprovalMetrics";
import { ChartCard } from "../../../components/common/ChartCard";

interface ApprovalMetricsProps {
  metrics: ApprovalMetricsData;
}

export function ApprovalMetrics({
  metrics,
}: ApprovalMetricsProps) {
  const rates = [
    { label: "Approval Rate", value: metrics.approvalRate, color: "success" as const },
    { label: "Rejection Rate", value: metrics.rejectionRate, color: "error" as const },
  ];

  const counts = [
    { label: "Pending Review", value: metrics.pendingReview },
    { label: "Total Reviewed", value: metrics.totalReviewed },
  ];

  return (
    <ChartCard
      title="Approval Metrics"
      subtitle="Overview of expense approval activity"
      minHeight={0}
    >
      <Stack spacing={2.5}>
        {rates.map((rate) => (
          <Stack key={rate.label} spacing={1}>
            <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
              <Typography variant="body2">{rate.label}</Typography>
              <Typography variant="subtitle2">
                <Typography variant="numeric">{rate.value.toFixed(1)}%</Typography>
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              color={rate.color}
              value={Math.min(rate.value, 100)}
              aria-label={`${rate.label} ${rate.value.toFixed(1)}%`}
            />
          </Stack>
        ))}

        {counts.map((count) => (
          <Stack key={count.label} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
            <Typography variant="body2">{count.label}</Typography>
            <Typography variant="subtitle2">
              <Typography variant="numeric">{count.value}</Typography>
            </Typography>
          </Stack>
        ))}
      </Stack>
    </ChartCard>
  );
}
