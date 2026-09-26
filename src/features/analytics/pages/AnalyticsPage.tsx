import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Chip, Grid, Stack, Typography } from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { RefreshingState } from "../../../components/common/RefreshingState";
import { useGetAnalyticsSummaryQuery } from "../api/analyticsApi";
import type { AnalyticsScope, AnalyticsSummary } from "../types/analytics";
import { EXPENSE_TYPE_LABELS } from "../../expenses/types/expense";
import { formatCurrency } from "../../../utils/currency";
import { AnalyticsFilterBar } from "../components/AnalyticsFilterBar";
import { KpiTrendCard } from "../components/KpiTrendCard";
import { SpendingTrendChart } from "../components/SpendingTrendChart";
import { ExpenseTypeDonut } from "../components/ExpenseTypeDonut";
import { DimensionBarChart } from "../components/DimensionBarChart";
import { BudgetComparisonChart } from "../components/BudgetComparisonChart";
import { WorkflowOverview } from "../components/WorkflowOverview";
import {
  DATE_PRESETS,
  formatDate,
  rangeError as getRangeError,
  readFilters,
  toQuery,
  writeFilters,
  type AnalyticsFilterState,
} from "../utils/analyticsFilters";
import { exportAnalyticsCsv } from "../utils/exportAnalyticsCsv";

const EMPTY_OPTIONS = { departments: [], teams: [] };

function scopeLabel(scope: AnalyticsScope, summary?: AnalyticsSummary): string {
  if (scope === "ORGANIZATION") return "Organization-wide";
  if (scope === "TEAM") return "Your team";
  const names = summary?.filterOptions.departments.map((department) => department.name) ?? [];
  return names.length ? `Departments: ${names.join(", ")}` : "Your departments";
}

function describeFilters(filters: AnalyticsFilterState, summary: AnalyticsSummary): string {
  const parts = [`${formatDate(summary.filters.from!)} to ${formatDate(summary.filters.to!)}`];
  const department = summary.filterOptions.departments.find((item) => item.id === filters.departmentId);
  const team = summary.filterOptions.teams.find((item) => item.id === filters.teamId);
  if (department) parts.push(`Department: ${department.name}`);
  if (team) parts.push(`Team: ${team.name}`);
  if (filters.type) parts.push(`Type: ${EXPENSE_TYPE_LABELS[filters.type]}`);
  return parts.join(" · ");
}

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const rangeError = getRangeError(filters);
  const query = useMemo(() => toQuery(filters), [filters]);

  const { data: summary, isLoading, isFetching, isError, error, refetch } = useGetAnalyticsSummaryQuery(query, {
    skip: Boolean(rangeError),
  });

  const setFilters = (next: AnalyticsFilterState) => setSearchParams(writeFilters(next), { replace: true });
  const resetFilters = () => setSearchParams(new URLSearchParams(), { replace: true });

  if (isLoading) return <LoadingState />;

  const scope = summary?.scope ?? "TEAM";
  const presetLabel = DATE_PRESETS.find((preset) => preset.value === filters.preset)?.label;
  const trend = summary?.spendingTrend ?? [];

  return (
    <Stack spacing={3}>
      {isFetching && <RefreshingState />}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}>
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            <Typography variant="h4">Spending Analytics</Typography>
            {summary && <Chip size="small" color="primary" variant="outlined" label={scopeLabel(scope, summary)} />}
          </Stack>
          <Typography color="text.secondary">
            {summary
              ? `${presetLabel === "Custom" ? "" : `${presetLabel} · `}${formatDate(summary.filters.from!)} – ${formatDate(summary.filters.to!)}. Spending counts reimbursed expenses only.`
              : "Analyze reimbursed spending and approval activity."}
          </Typography>
        </Stack>
        <Button
          variant="outlined"
          startIcon={<FileDownloadOutlinedIcon />}
          disabled={!summary || Boolean(rangeError)}
          onClick={() => summary && exportAnalyticsCsv(summary, describeFilters(filters, summary))}
        >
          Export CSV
        </Button>
      </Stack>

      <AnalyticsFilterBar
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        scope={scope}
        options={summary?.filterOptions ?? EMPTY_OPTIONS}
        rangeError={rangeError}
      />

      {isError && !rangeError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : summary && !rangeError && (
        <>
          {summary.kpis.expenseCount === 0 && (
            <Alert severity="info">
              No reimbursed expenses match these filters. Workflow figures below still include expenses that are in progress.
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiTrendCard
                label="Total spend"
                value={formatCurrency(summary.kpis.totalSpend)}
                current={summary.kpis.totalSpend}
                previous={summary.previousKpis.totalSpend}
                sparkline={trend.map((point) => point.amount)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiTrendCard
                label="Average expense"
                value={formatCurrency(summary.kpis.averageExpense, { maximumFractionDigits: 0 })}
                current={summary.kpis.averageExpense}
                previous={summary.previousKpis.averageExpense}
                sparkline={trend.map((point) => (point.count ? point.amount / point.count : 0))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiTrendCard
                label="Largest expense"
                value={formatCurrency(summary.kpis.largestExpense)}
                current={summary.kpis.largestExpense}
                previous={summary.previousKpis.largestExpense}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
              <KpiTrendCard
                label="Reimbursed expenses"
                value={String(summary.kpis.expenseCount)}
                current={summary.kpis.expenseCount}
                previous={summary.previousKpis.expenseCount}
                sparkline={trend.map((point) => point.count)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 12, lg: 2.4 }}>
              <KpiTrendCard
                label="Avg. time to reimburse"
                value={summary.kpis.averageDaysToReimburse === null ? "—" : `${summary.kpis.averageDaysToReimburse.toFixed(1)} days`}
                current={summary.kpis.averageDaysToReimburse}
                previous={summary.previousKpis.averageDaysToReimburse}
                lowerIsBetter
              />
            </Grid>

            <Grid size={{ xs: 12, lg: 8 }}>
              <SpendingTrendChart data={trend} interval={summary.interval} />
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <ExpenseTypeDonut data={summary.expenseTypeSpending} />
            </Grid>

            <Grid size={{ xs: 12, lg: 6 }}>
              <BudgetComparisonChart comparison={summary.budgetComparison} />
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <WorkflowOverview metrics={summary.approvalMetrics} statusCounts={summary.statusCounts} />
            </Grid>

            {/* Department and team comparisons are for Finance and Admin only. */}
            {scope !== "TEAM" && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <DimensionBarChart
                    title="Spending by department"
                    subtitle="Reimbursed spend per department"
                    data={summary.departmentSpending}
                    emptyMessage="No department spending in the selected period."
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <DimensionBarChart
                    title="Spending by team"
                    subtitle="Reimbursed spend per team"
                    data={summary.teamSpending}
                    emptyMessage="No team spending in the selected period."
                  />
                </Grid>
              </>
            )}
          </Grid>
        </>
      )}
    </Stack>
  );
}
