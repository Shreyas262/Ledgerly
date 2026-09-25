import { AddOutlined } from "@mui/icons-material";
import { Button, Grid, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useGetBudgetsQuery } from "../api/budgetsApi";
import { BudgetCard } from "../components/BudgetCard";
import { BudgetSummaryCard } from "../components/BudgetSummaryCard";
import { calculateBudgetSummary } from "../utils/calculateBudgetSummary";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { usePermissions } from "../../auth/hooks/usePermissions";
import { useAuth } from "../../auth/context/AuthContext";

export function BudgetsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { user } = useAuth();
  const { data: budgets, isLoading, isError } = useGetBudgetsQuery();
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;
  const summary = calculateBudgetSummary(budgets ?? []);
  const isAdmin = user?.role === "admin";
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, gap: 2 }}>
        <Stack spacing={0.5}>
          <Typography variant="h4">Budgets</Typography>
          <Typography color="text.secondary">Organization budgets, department allocations, and expense-type budgets.</Typography>
        </Stack>
        {isAdmin && can("budgets.create") && <Button variant="contained" startIcon={<AddOutlined />} onClick={() => navigate("/budgets/new")}>Create organization budget</Button>}
      </Stack>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><BudgetSummaryCard label="Organization Budget" value={`₹${summary.totalBudget.toLocaleString("en-IN")}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><BudgetSummaryCard label="Department Allocated" value={`₹${summary.totalAllocated.toLocaleString("en-IN")}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><BudgetSummaryCard label="Derived Spend" value={`₹${summary.totalSpent.toLocaleString("en-IN")}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><BudgetSummaryCard label="Utilization" value={`${summary.utilization.toFixed(1)}%`} description="Derived from approved financial expenses" /></Grid>
      </Grid>
      <Grid container spacing={2}>
        {(budgets ?? []).map((budget) => <Grid key={budget.id} size={{ xs: 12, md: 6, lg: 4 }}><BudgetCard budget={budget} onView={(selected) => navigate(`/budgets/${selected.id}`)} /></Grid>)}
      </Grid>
    </Stack>
  );
}
