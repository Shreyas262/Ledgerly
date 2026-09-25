import { useMemo, useState } from "react";
import { Alert, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { RefreshingState } from "../../../components/common/RefreshingState";
import { DashboardDateFilter } from "../../dashboard/components/DashboardDateFilter";
import { SpendingTrend } from "../../dashboard/components/SpendingTrend";
import { CategoryAnalysis } from "../../dashboard/components/CategoryAnalysis";
import { DimensionAnalysis } from "../../dashboard/components/DimensionAnalysis";
import { ApprovalMetrics } from "../../dashboard/components/ApprovalMetrics";
import { KpiCard } from "../../dashboard/components/KpiCard";
import { useGetAnalyticsSummaryQuery } from "../api/analyticsApi";
import type { AnalyticsQuery } from "../types/analytics";
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS, type ExpenseType } from "../../expenses/types/expense";

interface DateRange {
  startDate: string;
  endDate: string;
}

export function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: "", endDate: "" });
  const [expenseType, setExpenseType] = useState<ExpenseType | "">("");
  const [status, setStatus] = useState("");

  const isInvalidRange = Boolean(dateRange.startDate && dateRange.endDate && dateRange.startDate > dateRange.endDate);
  const query = useMemo<AnalyticsQuery>(() => ({
    from: dateRange.startDate || undefined,
    to: dateRange.endDate || undefined,
    type: expenseType || undefined,
    status: status.trim() || undefined,
  }), [dateRange, expenseType, status]);

  const { data: summary, isLoading, isFetching, isError } = useGetAnalyticsSummaryQuery(query, {
    skip: isInvalidRange,
  });

  if (isLoading) return <LoadingState />;
  if (isError || !summary) return <ErrorState />;

  return (
    <Stack spacing={3}>
      {isFetching && <RefreshingState />}
      <Stack spacing={0.5}>
        <Typography variant="h4">Analytics</Typography>
        <Typography color="text.secondary">
          Analyze expense spending and approval activity across your authorized {summary.scope.toLowerCase()} scope.
        </Typography>
      </Stack>

      <Stack spacing={2}>
        <DashboardDateFilter value={dateRange} onChange={setDateRange} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            select
            label="Expense Type"
            value={expenseType}
            onChange={(event) => setExpenseType(event.target.value as ExpenseType | "")}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All expense types</MenuItem>
            {EXPENSE_TYPES.map((type) => (
              <MenuItem key={type} value={type}>{EXPENSE_TYPE_LABELS[type]}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="Optional status filter"
          />
        </Stack>
      </Stack>

      {isInvalidRange && <Alert severity="warning">Start date must be before or equal to end date.</Alert>}
      {!isInvalidRange && summary.kpis.expenseCount === 0 && (
        <Alert severity="info">No expenses were found for the selected analytics filters.</Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard label="Total Spend" value={`₹${summary.kpis.totalSpend.toLocaleString("en-IN")}`} description="Authorized analytical spend" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard label="Average Expense" value={`₹${summary.kpis.averageExpense.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} description="Average expense amount" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard label="Largest Expense" value={`₹${summary.kpis.largestExpense.toLocaleString("en-IN")}`} description="Highest individual expense" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard label="Pending Spend" value={`₹${summary.kpis.pendingSpend.toLocaleString("en-IN")}`} description="Awaiting approval" />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <SpendingTrend data={summary.spendingTrend.map((item) => ({ month: item.period, amount: item.amount }))} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <CategoryAnalysis data={summary.expenseTypeSpending} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ApprovalMetrics metrics={summary.approvalMetrics} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <DimensionAnalysis
            title="Spending by Department"
            description="Expense spending across authorized departments"
            data={summary.departmentSpending.map((item) => ({ name: item.dimensionName, amount: item.amount }))}
            emptyMessage="There is no department spending data in the selected range."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <DimensionAnalysis
            title="Spending by Team"
            description="Expense spending across authorized teams"
            data={summary.teamSpending.map((item) => ({ name: item.dimensionName, amount: item.amount }))}
            emptyMessage="There is no team spending data in the selected range."
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <DimensionAnalysis
            title="Spending by Project"
            description="Expense spending across authorized projects"
            data={summary.projectSpending.map((item) => ({ name: item.dimensionName, amount: item.amount }))}
            emptyMessage="There is no project spending data in the selected range."
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
