import { useMemo, useState } from "react";
import {
  Alert,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { RefreshingState } from "../../../components/common/RefreshingState";
import { DashboardDateFilter } from "../components/DashboardDateFilter";
import { KpiCard } from "../components/KpiCard";
import { SpendingTrend } from "../components/SpendingTrend";
import { CategoryAnalysis } from "../components/CategoryAnalysis";
import { ApprovalMetrics } from "../components/ApprovalMetrics";
import { useGetDashboardSummaryQuery } from "../api/dashboardApi";

interface DashboardDateRange {
  startDate: string;
  endDate: string;
}

export function DashboardPage() {
  const [dateRange, setDateRange] = useState<DashboardDateRange>({
    startDate: "",
    endDate: "",
  });

  const isInvalidRange =
    Boolean(dateRange.startDate) &&
    Boolean(dateRange.endDate) &&
    dateRange.startDate > dateRange.endDate;

  const query = useMemo(
    () => ({
      from: dateRange.startDate || undefined,
      to: dateRange.endDate || undefined,
    }),
    [dateRange],
  );

  const {
    data: summary,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetDashboardSummaryQuery(query, {
    skip: isInvalidRange,
  });

  if (isLoading) return <LoadingState />;
  if (isError || !summary) return <ErrorState error={error} onRetry={refetch} />;

  const hasData = summary.kpis.totalSpending > 0 ||
    summary.kpis.pendingApproval > 0 ||
    summary.kpis.approvedExpenses > 0 ||
    summary.kpis.rejectedExpenses > 0;

  return (
    <Stack spacing={2}>
      {isFetching && <RefreshingState />}
      <Stack spacing={0.5}>
        <Typography variant="h4">My Expenses Overview</Typography>
        <Typography color="text.secondary">
          Summary of the expenses you have created.
        </Typography>
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ display: "flex", justifyContent: "flex-start" }}
        spacing={2}
      >
        <Typography>Filters:</Typography>
        <DashboardDateFilter
          value={dateRange}
          onChange={setDateRange}
        />
      </Stack>

      {isInvalidRange && (
        <Alert severity="warning">
          Start date must be before or equal to end date.
        </Alert>
      )}

      {!isInvalidRange && !hasData && (
        <Alert severity="info">
          No expenses were found for the selected date range.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: "grow" }}>
          <KpiCard
            label="Reimbursed Spending"
            value={`₹${summary.kpis.totalSpending.toLocaleString("en-IN")}`}
            description="Reimbursed expenses only"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: "grow" }}>
          <KpiCard
            label="Pending Approval"
            value={summary.kpis.pendingApproval}
            description="Submitted or under review"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: "grow" }}>
          <KpiCard
            label="Approved Expenses"
            value={summary.kpis.approvedExpenses}
            description="Approved expenses"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: "grow" }}>
          <KpiCard
            label="Rejected Expenses"
            value={summary.kpis.rejectedExpenses}
            description="Rejected expenses"
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <SpendingTrend data={summary.spendingTrend} />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CategoryAnalysis data={summary.expenseTypeSpending} />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <ApprovalMetrics metrics={summary.approvalMetrics} />
        </Grid>
      </Grid>
    </Stack>
  );
}
