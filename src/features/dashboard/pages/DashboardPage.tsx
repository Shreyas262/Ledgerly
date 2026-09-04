import {
  Alert,
  Grid,
  Stack,
  Typography,
 } from "@mui/material";

import { useGetExpensesQuery } from "../../expenses/api/expenseApi";
import { calculateExpenseKpis } from "../utils/calculateExpenseKpis";

import { KpiCard } from "../components/KpiCard";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { calculateMonthlySpending } from "../utils/calculateMonthlySpending";
import { SpendingTrend } from "../components/SpendingTrend";
import { CategoryAnalysis } from "../components/CategoryAnalysis";
import { calculateCategorySpending } from "../utils/calculateCategorySpending";
import { DimensionAnalysis } from "../components/DimensionAnalysis";
import { calculateDimensionSpending } from "../utils/calculateDimensionSpending";
import { ApprovalMetrics } from "../components/ApprovalMetrics";
import { calculateApprovalMetrics } from "../utils/calculateApprovalMetrics";
import { useMemo, useState } from "react";
import { DashboardDateFilter } from "../components/DashboardDateFilter";
import { filterExpensesByDate } from "../utils/filterExpensesByDate";
import type { DashboardDateRange } from "../types/dashboardFilters";

export function DashboardPage() {

  const [dateRange, setDateRange] =
    useState<DashboardDateRange>({
      startDate: "",
      endDate: "",
    });

  const {
    data: expenses,
    isLoading,
    isError,
  } = useGetExpensesQuery();

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState />;
  }

  const filteredExpenses = useMemo(
    () =>
      filterExpensesByDate(
        expenses ?? [],
        dateRange,
      ),
    [expenses, dateRange],
  );
  const hasFilteredExpenses = filteredExpenses.length > 0;

  const kpis = calculateExpenseKpis(
    filteredExpenses,
  );

  const monthlySpending = calculateMonthlySpending(
    filteredExpenses,
  );

  const categorySpending =
    calculateCategorySpending(
      filteredExpenses,
    );

  const departmentSpending =
    calculateDimensionSpending(
      filteredExpenses,
      (expense) => expense.department,
    );

  const projectSpending =
    calculateDimensionSpending(
      filteredExpenses,
      (expense) => expense.project,
    );

  const approvalMetrics =
    calculateApprovalMetrics(
      filteredExpenses,
    );

  return (
    <Stack spacing={2}>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ display: "flex", justifyContent: "flex-start", }}
        spacing={2}
      >
        <Typography
        >
          Filters: 
        </Typography>

        <DashboardDateFilter
          value={dateRange}
          onChange={setDateRange}
        />
      </Stack>

      {!hasFilteredExpenses && (
        <Alert severity="info">
          No expenses were found for the selected date range.
        </Alert>
      )}

      <Grid
        container
        spacing={2}
      >
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Total Spending"
            value={`₹${kpis.totalSpending.toLocaleString(
              "en-IN",
            )}`}
            description="Across all expenses"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Pending Approval"
            value={kpis.pendingApproval}
            description="Submitted or under review"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Approved Expenses"
            value={kpis.approvedExpenses}
            description="Approved expenses"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Rejected Expenses"
            value={kpis.rejectedExpenses}
            description="Rejected expenses"
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <SpendingTrend data={monthlySpending} />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <CategoryAnalysis data={categorySpending} />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DimensionAnalysis
            title="Spending by Department"
            description="Expense spending across departments"
            data={departmentSpending}
            emptyMessage="No department data available."
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DimensionAnalysis
            title="Spending by Project"
            description="Expense spending across projects"
            data={projectSpending}
            emptyMessage="No project data available."
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <ApprovalMetrics metrics={approvalMetrics} />
        </Grid>
        
      </Grid>
    </Stack>
)}