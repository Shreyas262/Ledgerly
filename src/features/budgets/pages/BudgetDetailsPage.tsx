import { useState } from "react";
import { ArrowBackOutlined } from "@mui/icons-material";
import { Button, Card, CardContent, Chip, Divider, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useGetBudgetByIdQuery, useActivateBudgetMutation, useCloseBudgetMutation, useUpsertDepartmentAllocationMutation, useUpsertExpenseTypeBudgetMutation } from "../api/budgetsApi";
import { useGetDepartmentsQuery } from "../../organizations/api/organizationApi";
import { useAuth } from "../../auth/context/AuthContext";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS, type ExpenseType } from "../../expenses/types/expense";
import { getApiErrorMessage } from "../../../services/api/apiErrors";

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export function BudgetDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: budget, isLoading, isError } = useGetBudgetByIdQuery(id ?? "", { skip: !id });
  const isAdmin = user?.role === "admin";
  const isFinance = user?.role === "finance";
  const { data: departments = [] } = useGetDepartmentsQuery(undefined, { skip: !isAdmin });
  const [activateBudget, { isLoading: activating }] = useActivateBudgetMutation();
  const [closeBudget, { isLoading: closing }] = useCloseBudgetMutation();
  const [saveAllocation, { isLoading: savingAllocation }] = useUpsertDepartmentAllocationMutation();
  const [saveExpenseTypeBudget, { isLoading: savingExpenseType }] = useUpsertExpenseTypeBudgetMutation();
  const [departmentId, setDepartmentId] = useState("");
  const [departmentAmount, setDepartmentAmount] = useState("");
  const [allocationId, setAllocationId] = useState("");
  const [expenseType, setExpenseType] = useState<ExpenseType>("MEALS");
  const [expenseTypeAmount, setExpenseTypeAmount] = useState("");
  const [error, setError] = useState("");

  if (isLoading) return <LoadingState />;
  if (isError || !budget) return <ErrorState />;

  const canManage = budget.status !== "closed";
  const allocation = budget.departmentAllocations.find((item) => item.id === allocationId);

  const handleLifecycle = async (action: "activate" | "close") => {
    try {
      setError("");
      await (action === "activate" ? activateBudget(budget.id) : closeBudget(budget.id)).unwrap();
    } catch (e) {
      setError(getApiErrorMessage(e, "Unable to change the budget status."));
    }
  };

  const handleDepartmentAllocation = async () => {
    if (!departmentId || Number(departmentAmount) <= 0) return setError("Select a department and enter a positive allocation.");
    try { setError(""); await saveAllocation({ organizationBudgetId: budget.id, departmentId, amount: Number(departmentAmount) }).unwrap(); setDepartmentAmount(""); } catch (e) { setError(getApiErrorMessage(e, "Unable to save the department allocation.")); }
  };

  const handleExpenseTypeBudget = async () => {
    if (!allocation || Number(expenseTypeAmount) <= 0) return setError("Select a department allocation and enter a positive expense-type amount.");
    try { setError(""); await saveExpenseTypeBudget({ organizationBudgetId: budget.id, departmentAllocationId: allocation.id, departmentId: allocation.departmentId, expenseType, amount: Number(expenseTypeAmount) }).unwrap(); setExpenseTypeAmount(""); } catch (e) { setError(getApiErrorMessage(e, "Unable to save the expense-type budget.")); }
  };

  return (
    <Stack spacing={3}>
      <Button startIcon={<ArrowBackOutlined />} onClick={() => navigate("/budgets")} sx={{ alignSelf: "flex-start" }}>Back to Budgets</Button>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, gap: 2 }}>
        <Stack spacing={0.5}><Typography variant="h4">{budget.name}</Typography><Typography color="text.secondary">{budget.startDate} → {budget.endDate}</Typography></Stack>
        <Chip label={budget.status.toUpperCase()} />
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}><Card><CardContent><Typography color="text.secondary">Organization Budget</Typography><Typography variant="h5">{money(budget.amount)}</Typography></CardContent></Card></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><Card><CardContent><Typography color="text.secondary">Derived Spend</Typography><Typography variant="h5">{money(budget.utilization.spentAmount)}</Typography></CardContent></Card></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><Card><CardContent><Typography color="text.secondary">Utilization</Typography><Typography variant="h5">{budget.utilization.utilizationPercent.toFixed(1)}%</Typography></CardContent></Card></Grid>
      </Grid>

      {isAdmin && canManage && <Stack direction="row" spacing={2}>{budget.status === "draft" && <Button variant="contained" disabled={activating} onClick={() => handleLifecycle("activate")}>Activate budget</Button>}{budget.status === "active" && <Button variant="outlined" disabled={closing} onClick={() => handleLifecycle("close")}>Close budget</Button>}<Button onClick={() => navigate(`/budgets/${budget.id}/edit`)}>Edit organization budget</Button></Stack>}

      {isAdmin && canManage && <Card><CardContent><Stack spacing={2}><Typography variant="h6">Department allocations</Typography><Stack direction={{ xs: "column", md: "row" }} spacing={2}><TextField select label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} fullWidth><MenuItem value="">Select department</MenuItem>{departments.map((department) => <MenuItem key={department.id} value={department.id}>{department.name}</MenuItem>)}</TextField><TextField label="Allocation" type="number" value={departmentAmount} onChange={(e) => setDepartmentAmount(e.target.value)} fullWidth /><Button variant="contained" onClick={handleDepartmentAllocation} disabled={savingAllocation}>Save allocation</Button></Stack><Divider />{budget.departmentAllocations.map((item) => <Stack key={item.id} direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1 }}><Typography>{item.departmentName}</Typography><Typography>{money(item.amount)} allocated · {money(item.utilization.spentAmount)} spent · {item.utilization.utilizationPercent.toFixed(1)}%</Typography></Stack>)}</Stack></CardContent></Card>}

      {isFinance && canManage && <Card><CardContent><Stack spacing={2}><Typography variant="h6">Expense-type budgets</Typography><TextField select label="Department allocation" value={allocationId} onChange={(e) => setAllocationId(e.target.value)} fullWidth><MenuItem value="">Select department allocation</MenuItem>{budget.departmentAllocations.map((item) => <MenuItem key={item.id} value={item.id}>{item.departmentName} — {money(item.amount)}</MenuItem>)}</TextField><Stack direction={{ xs: "column", md: "row" }} spacing={2}><TextField select label="Expense type" value={expenseType} onChange={(e) => setExpenseType(e.target.value as ExpenseType)} fullWidth>{EXPENSE_TYPES.map((type) => <MenuItem key={type} value={type}>{EXPENSE_TYPE_LABELS[type]}</MenuItem>)}</TextField><TextField label="Expense-type budget" type="number" value={expenseTypeAmount} onChange={(e) => setExpenseTypeAmount(e.target.value)} fullWidth /><Button variant="contained" onClick={handleExpenseTypeBudget} disabled={savingExpenseType}>Save budget</Button></Stack><Divider />{budget.departmentAllocations.filter((item) => (user?.authorizedDepartmentIds ?? [user?.departmentId]).includes(item.departmentId)).map((item) => <Stack key={item.id} spacing={1}><Typography variant="subtitle1">{item.departmentName}</Typography>{item.expenseTypeBudgets.map((child) => <Stack key={child.id} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}><Typography>{EXPENSE_TYPE_LABELS[child.expenseType] ?? child.expenseType}</Typography><Typography>{money(child.amount)} · {money(child.utilization.spentAmount)} spent · {child.utilization.utilizationPercent.toFixed(1)}%</Typography></Stack>)}</Stack>)}</Stack></CardContent></Card>}

      {error && <Typography color="error">{error}</Typography>}
      {!isAdmin && !isFinance && <Typography color="text.secondary">Budget data is read-only for this role.</Typography>}
    </Stack>
  );
}
