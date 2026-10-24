import { useMemo, useState } from "react";
import {
  Alert,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

import { ErrorState } from "../../../components/common/ErrorState";
import { FloatingAction } from "../../../components/common/FloatingAction";
import { LoadingState } from "../../../components/common/LoadingState";
import { PlusIcon } from "../../../components/common/PlusIcon";
import { RefreshingState } from "../../../components/common/RefreshingState";
import { DashboardDateFilter } from "../components/DashboardDateFilter";
import { DashboardAttention } from "../components/DashboardAttention";
import { DashboardWorkQueues } from "../components/DashboardWorkQueues";
import { KpiCard } from "../components/KpiCard";
import { RecentExpenses } from "../components/RecentExpenses";
import { SpendingTrend } from "../components/SpendingTrend";
import { CategoryAnalysis } from "../components/CategoryAnalysis";
import { ApprovalMetrics } from "../components/ApprovalMetrics";
import { useGetDashboardSummaryQuery } from "../api/dashboardApi";
import { DEFAULT_DASHBOARD_RANGE, type DashboardDateRange } from "../utils/dashboardRange";
import { usePermissions } from "../../auth/hooks/usePermissions";
import { formatCurrency } from "../../../utils/currency";
import { PageHeader } from "../../../components/common/PageHeader";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function DashboardPage() {
  const { can } = usePermissions();
  const [dateRange, setDateRange] = useState<DashboardDateRange>(DEFAULT_DASHBOARD_RANGE);

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
  } = useGetDashboardSummaryQuery(query);

  if (isLoading) return <LoadingState />;
  if (isError || !summary) return <ErrorState error={error} onRetry={refetch} />;

  const { kpis, owed } = summary;
  const hasData = kpis.totalSpending > 0 ||
    kpis.pendingApproval > 0 ||
    kpis.approvedExpenses > 0 ||
    kpis.rejectedExpenses > 0;
  // Offered only when the form can actually be used (§28.16).
  const canAddExpense = can("expenses.create") && !summary.attention.creationBlockedReason;

  return (
    <Stack spacing={2} sx={{ pb: canAddExpense ? 10 : 0 }}>
      {isFetching && <RefreshingState />}
      <PageHeader
        title="My Expenses Overview"
        description="A summary of the expenses you have created. Spend includes reimbursed expenses only."
      />

      <DashboardWorkQueues queues={summary.workQueues} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <DashboardAttention attention={summary.attention} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiCard
            label="Owed to you"
            value={formatCurrency(owed.amount)}
            description={
              owed.count
                ? `${plural(owed.count, "approved expense", "approved expenses")} waiting for payment`
                : "Nothing is waiting for payment"
            }
          />
        </Grid>
      </Grid>

      <RecentExpenses expenses={summary.recent} />

      <Typography variant="h6" component="h2" sx={{ pt: 1 }}>
        Your expenses in the selected period
      </Typography>

      <DashboardDateFilter
        value={dateRange}
        onChange={setDateRange}
      />

      {!hasData && (
        <Alert severity="info">
          No expenses were found in the selected date range.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: "grow" }}>
          <KpiCard
            label="Spend"
            value={formatCurrency(kpis.totalSpending)}
            description="Total amount paid out"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: "grow" }}>
          <KpiCard
            label="Pending approval"
            value={kpis.pendingApproval}
            description={`${formatCurrency(kpis.pendingAmount)} submitted or under review`}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: "grow" }}>
          <KpiCard
            label="Approved expenses"
            value={kpis.approvedExpenses}
            description={`${formatCurrency(kpis.approvedAmount)}, including those in or past reimbursement`}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: "grow" }}>
          <KpiCard
            label="Rejected expenses"
            value={kpis.rejectedExpenses}
            description={`${formatCurrency(kpis.rejectedAmount)} returned by a reviewer`}
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

      {canAddExpense && <FloatingAction label="Add Expense" to="/expenses/new" icon={<PlusIcon sx={{ fontSize: 28 }} />} />}
    </Stack>
  );
}
