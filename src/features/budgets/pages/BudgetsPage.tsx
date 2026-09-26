import { AddOutlined } from "@mui/icons-material";
import { Alert, Button, Grid, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useGetBudgetsQuery } from "../api/budgetsApi";
import { BudgetCard } from "../components/BudgetCard";
import { BudgetSummaryCard } from "../components/BudgetSummaryCard";
import { formatCurrency } from "../../../utils/currency";
import { calculateBudgetSummary } from "../utils/calculateBudgetSummary";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { usePermissions } from "../../auth/hooks/usePermissions";
import { useAuth } from "../../auth/context/AuthContext";
import { PageHeader } from "../../../components/common/PageHeader";

const scopeCopy = {
  ORGANIZATION: { subtitle: "Organization budgets and their department allocations.", budget: "Organization budget", allocated: "Allocated to departments" },
  DEPARTMENT: { subtitle: "Budgets for your departments and how they are split across teams.", budget: "Department budgets", allocated: "Allocated to teams" },
  TEAM: { subtitle: "Your team's budget and expense-type limits.", budget: "Team budget", allocated: "Set for expense types" },
} as const;

export function BudgetsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { user } = useAuth();
  const { data: budgets, isLoading, isError, error, refetch } = useGetBudgetsQuery();
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const list = budgets ?? [];
  const summary = calculateBudgetSummary(list);
  const copy = scopeCopy[summary.scope];
  const canCreate = user?.role === "admin" && can("budgets.create");
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const endedBudgets = list.filter((budget) => budget.status === "active" && budget.endDate < today);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Budgets"
        description={copy.subtitle}
        actions={canCreate && (
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => navigate("/budgets/new")}>
            Create organization budget
          </Button>
        )}
      />

      {canCreate && endedBudgets.map((budget) => (
        <Alert
          key={budget.id}
          severity="warning"
          action={<Button color="inherit" size="small" onClick={() => navigate(`/budgets/${budget.id}`)}>Review</Button>}
        >
          "{budget.name}" ended on {budget.endDate}. Close it or start the next period — new expenses can't be created until a budget covering today is active.
        </Alert>
      ))}

      {list.length === 0 ? (
        <EmptyState
          title="No budgets yet"
          message={canCreate
            ? "Create an organization budget, then allocate it to departments."
            : "No budget has been allocated to your scope yet."}
        />
      ) : (
        <>
          {summary.activeBudgetCount === 0 ? (
            <Alert severity="info">There is no active budget. Totals appear once a budget is activated.</Alert>
          ) : (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><BudgetSummaryCard label={copy.budget} value={formatCurrency(summary.totalBudget)} description="Active budgets" /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><BudgetSummaryCard label={copy.allocated} value={formatCurrency(summary.totalAllocated)} description={`${formatCurrency(Math.max(summary.totalBudget - summary.totalAllocated, 0))} unallocated`} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><BudgetSummaryCard label="Reimbursed spend" value={formatCurrency(summary.totalSpent)} description={`${formatCurrency(summary.totalRemaining)} remaining`} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}><BudgetSummaryCard label="Utilization" value={`${summary.utilization.toFixed(1)}%`} description="Only reimbursed expenses consume budget" /></Grid>
            </Grid>
          )}
          <Grid container spacing={2}>
            {list.map((budget) => (
              <Grid key={budget.id} size={{ xs: 12, md: 6, lg: 4 }}>
                <BudgetCard budget={budget} onView={(selected) => navigate(`/budgets/${selected.id}`)} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Stack>
  );
}
