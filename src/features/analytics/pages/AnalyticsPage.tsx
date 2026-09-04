import { useMemo, useState } from "react";
import {
  Alert,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

import { useGetExpensesQuery } from "../../expenses/api/expenseApi";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";

import { DashboardDateFilter } from "../../dashboard/components/DashboardDateFilter";

import { SpendingTrend } from "../../dashboard/components/SpendingTrend";
import { CategoryAnalysis } from "../../dashboard/components/CategoryAnalysis";
import { DimensionAnalysis } from "../../dashboard/components/DimensionAnalysis";
import { ApprovalMetrics } from "../../dashboard/components/ApprovalMetrics";

import { calculateMonthlySpending } from "../../dashboard/utils/calculateMonthlySpending";
import { calculateCategorySpending } from "../../dashboard/utils/calculateCategorySpending";
import { calculateDimensionSpending } from "../../dashboard/utils/calculateDimensionSpending";
import { calculateApprovalMetrics } from "../../dashboard/utils/calculateApprovalMetrics";
import { filterExpensesByDate } from "../../dashboard/utils/filterExpensesByDate";
import { KpiCard } from "../../dashboard/components/KpiCard";
import { calculateAnalyticsKpis } from "../utils/calculateAnalyticsKpis";

export interface DashboardDateRange {
  startDate: string;
  endDate: string;
}

export function AnalyticsPage() {
  const {
    data: expenses,
    isLoading,
    isError,
  } = useGetExpensesQuery();

  const [dateRange, setDateRange] =
    useState<DashboardDateRange>({
      startDate: "",
      endDate: "",
    });

  const filteredExpenses = useMemo(
    () =>
      filterExpensesByDate(
        expenses ?? [],
        dateRange,
      ),
    [expenses, dateRange],
  );

  const monthlySpending = useMemo(
    () =>
      calculateMonthlySpending(
        filteredExpenses,
      ),
    [filteredExpenses],
  );

  const categorySpending = useMemo(
    () =>
      calculateCategorySpending(
        filteredExpenses,
      ),
    [filteredExpenses],
  );

  const departmentSpending = useMemo(
    () =>
      calculateDimensionSpending(
        filteredExpenses,
        (expense) => expense.department,
      ),
    [filteredExpenses],
  );

  const projectSpending = useMemo(
    () =>
      calculateDimensionSpending(
        filteredExpenses,
        (expense) => expense.project,
      ),
    [filteredExpenses],
  );

  const approvalMetrics = useMemo(
    () =>
      calculateApprovalMetrics(
        filteredExpenses,
      ),
    [filteredExpenses],
  );
  
  const analyticsKpis = useMemo(
    () =>
        calculateAnalyticsKpis(
        filteredExpenses,
        ),
    [filteredExpenses],
  );

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState />;
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4">
          Analytics
        </Typography>

        <Typography
          color="text.secondary"
        >
          Analyze expense spending and approval activity.
        </Typography>
      </Stack>

      <DashboardDateFilter
        value={dateRange}
        onChange={setDateRange}
      />
      
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
            label="Average Expense"
            value={`₹${analyticsKpis.averageExpense.toLocaleString(
                "en-IN",
                {
                maximumFractionDigits: 0,
                },
            )}`}
            description="Average expense amount"
            />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
            label="Largest Expense"
            value={`₹${analyticsKpis.largestExpense.toLocaleString(
                "en-IN",
            )}`}
            description="Highest individual expense"
            />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
            label="Approved Spend"
            value={`₹${analyticsKpis.approvedSpend.toLocaleString(
                "en-IN",
            )}`}
            description="Approved and reimbursed"
            />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
            label="Pending Spend"
            value={`₹${analyticsKpis.pendingSpend.toLocaleString(
                "en-IN",
            )}`}
            description="Awaiting approval"
            />
        </Grid>
      </Grid>

      {filteredExpenses.length === 0 && (
        <Alert severity="info">
            No expenses were found for the selected filters.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <SpendingTrend
            data={monthlySpending}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CategoryAnalysis
            data={categorySpending}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <ApprovalMetrics
            metrics={approvalMetrics}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DimensionAnalysis
            title="Spending by Department"
            description="Expense spending across departments"
            data={departmentSpending}
            emptyMessage="There are no department assignments in the selected date range."
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DimensionAnalysis
            title="Spending by Project"
            description="Expense spending across projects"
            data={projectSpending}
            emptyMessage="There are no project assignments in the selected date range."
          />
        </Grid>
      </Grid>
    </Stack>
  );
}