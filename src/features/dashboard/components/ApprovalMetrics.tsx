import {
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";

import type { ApprovalMetrics as ApprovalMetricsData } from "../utils/calculateApprovalMetrics";

interface ApprovalMetricsProps {
  metrics: ApprovalMetricsData;
}

export function ApprovalMetrics({
  metrics,
}: ApprovalMetricsProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Stack spacing={0.5}>
            <Typography variant="h6">
              Approval Metrics
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
            >
              Overview of expense approval activity
            </Typography>
          </Stack>

          <Stack spacing={2}>
            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Typography variant="body2">
                Approval Rate
              </Typography>

              <Typography variant="body2">
                {metrics.approvalRate.toFixed(1)}%
              </Typography>
            </Stack>

            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Typography variant="body2">
                Rejection Rate
              </Typography>

              <Typography variant="body2">
                {metrics.rejectionRate.toFixed(1)}%
              </Typography>
            </Stack>

            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Typography variant="body2">
                Pending Review
              </Typography>

              <Typography variant="body2">
                {metrics.pendingReview}
              </Typography>
            </Stack>

            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Typography variant="body2">
                Total Reviewed
              </Typography>

              <Typography variant="body2">
                {metrics.totalReviewed}
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}