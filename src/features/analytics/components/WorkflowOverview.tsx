import { Box, Stack, Typography } from "@mui/material";
import { Gauge, gaugeClasses } from "@mui/x-charts/Gauge";
import { BarChart } from "@mui/x-charts/BarChart";
import type { AnalyticsApprovalMetrics, AnalyticsSummary } from "../types/analytics";
import { ChartCard } from "../../../components/common/ChartCard";
import { EXPENSE_STATUS_LABELS } from "../utils/statusLabels";
import { useChartColors } from "../utils/chartColors";

interface WorkflowOverviewProps {
  metrics: AnalyticsApprovalMetrics;
  statusCounts: AnalyticsSummary["statusCounts"];
}

export function WorkflowOverview({ metrics, statusCounts }: WorkflowOverviewProps) {
  const colors = useChartColors();
  const total = statusCounts.reduce((sum, item) => sum + item.count, 0);
  const rate = Math.round(metrics.approvalRate);

  return (
    <ChartCard
      title="Approval workflow"
      subtitle="All submitted expenses in the period, by current status"
      isEmpty={total === 0}
      emptyMessage="No submitted expenses in the selected period."
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: "center" }}>
        <Stack sx={{ alignItems: "center", flexShrink: 0, width: 200 }}>
          <Gauge
            width={200}
            height={150}
            value={rate}
            startAngle={-110}
            endAngle={110}
            innerRadius="72%"
            cornerRadius="50%"
            text={({ value }) => `${value ?? 0}%`}
            sx={{
              [`& .${gaugeClasses.valueText}`]: { fontSize: 28, fontWeight: 600 },
              [`& .${gaugeClasses.valueArc}`]: { fill: rate >= 70 ? colors.success : rate >= 40 ? colors.warning : colors.error },
            }}
          />
          <Typography variant="body2" color="text.secondary">Approval rate</Typography>
          <Typography variant="caption" color="text.secondary">
            {metrics.totalReviewed} reviewed · {metrics.pendingReview} awaiting review
          </Typography>
        </Stack>
        <Box sx={{ flex: 1, width: "100%", minWidth: 0 }}>
          <BarChart
            height={260}
            layout="horizontal"
            yAxis={[{
              scaleType: "band",
              data: statusCounts.map((item) => EXPENSE_STATUS_LABELS[item.status]),
              width: 150,
              colorMap: { type: "ordinal", colors: statusCounts.map((item) => colors.status[item.status]) },
            }]}
            xAxis={[{ tickMinStep: 1 }]}
            series={[{ data: statusCounts.map((item) => item.count), label: "Expenses" }]}
            grid={{ vertical: true }}
            hideLegend
            borderRadius={4}
            margin={{ top: 8, right: 24 }}
          />
        </Box>
      </Stack>
    </ChartCard>
  );
}
