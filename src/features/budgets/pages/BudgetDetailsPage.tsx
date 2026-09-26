import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";

import {
  useActivateBudgetMutation,
  useCloseBudgetMutation,
  useGetBudgetByIdQuery,
  useReopenBudgetMutation,
  useRolloverBudgetMutation,
  useUpsertDepartmentAllocationMutation,
  useUpsertExpenseTypeBudgetMutation,
  useUpsertTeamAllocationMutation,
} from "../api/budgetsApi";
import { useGetDepartmentsQuery } from "../../organizations/api/organizationApi";
import { useAuth } from "../../auth/context/AuthContext";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { BackLink } from "../../../components/navigation/BackLink";
import { getApiErrorMessage } from "../../../services/api/apiErrors";
import {
  EXPENSE_TYPES,
  EXPENSE_TYPE_LABELS,
  type ExpenseType,
} from "../../expenses/types/expense";
import { BudgetProgress } from "../components/BudgetProgress";
import { formatCurrency } from "../../../utils/currency";
import type { DepartmentBudgetView, OrganizationBudgetView } from "../types/budget";
import { useConfirm, type ConfirmOptions } from "../../../components/common/ConfirmProvider";
import { PageHeader } from "../../../components/common/PageHeader";

type Runner = (
  action: () => Promise<unknown>,
  success: string,
  fallback: string,
  confirmation?: ConfirmOptions,
) => Promise<boolean>;

const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Suggests the next period: starts the day after, same length. */
function nextPeriod(budget: OrganizationBudgetView) {
  const start = new Date(`${budget.startDate}T00:00:00`);
  const end = new Date(`${budget.endDate}T00:00:00`);
  const lengthDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const nextStart = new Date(end);
  nextStart.setDate(nextStart.getDate() + 1);
  const nextEnd = new Date(nextStart);
  nextEnd.setDate(nextEnd.getDate() + lengthDays);
  return { startDate: toDateInput(nextStart), endDate: toDateInput(nextEnd) };
}

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function BudgetDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: budget, isLoading, isError, error: loadError, refetch } = useGetBudgetByIdQuery(id ?? "", { skip: !id });
  const isAdmin = user?.role === "admin";
  const { data: departments = [] } = useGetDepartmentsQuery(undefined, { skip: !isAdmin });
  const [activateBudget, { isLoading: activating }] = useActivateBudgetMutation();
  const [closeBudget, { isLoading: closing }] = useCloseBudgetMutation();
  const [reopenBudget, { isLoading: reopening }] = useReopenBudgetMutation();
  const [rolloverBudget, { isLoading: rollingOver }] = useRolloverBudgetMutation();
  const confirm = useConfirm();
  const [rollover, setRollover] = useState<{ name: string; startDate: string; endDate: string } | null>(null);
  const [saveDepartment, { isLoading: savingDepartment }] = useUpsertDepartmentAllocationMutation();
  const [departmentId, setDepartmentId] = useState("");
  const [departmentAmount, setDepartmentAmount] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (isLoading) return <LoadingState />;
  if (isError || !budget) return <ErrorState error={loadError} onRetry={refetch} />;

  const editable = budget.status !== "closed";
  const run: Runner = async (action, success, fallback, confirmation) => {
    if (confirmation && !(await confirm(confirmation))) return false;
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      return true;
    } catch (caught) {
      setError(getApiErrorMessage(caught, fallback));
      return false;
    }
  };

  const allocatedToDepartments = budget.departmentAllocations.reduce((sum, item) => sum + item.amount, 0);
  const periodEnded = budget.status === "active" && budget.endDate < toDateInput(new Date());
  const openRollover = () => setRollover({ name: `${budget.name} (next period)`, ...nextPeriod(budget) });
  const handleClose = async () => {
    const closed = await run(
      () => closeBudget(budget.id).unwrap(),
      "Budget closed.",
      "Unable to close the budget.",
      {
        title: "Close budget",
        message: "Close this budget because its period has ended or it is being replaced? It stops tracking spend and new expenses can't be created until another budget is active. You can reopen it if this was a mistake.",
        confirmLabel: "Close budget",
        destructive: true,
      },
    );
    if (closed) openRollover();
  };
  const canManageDepartment = (department: DepartmentBudgetView) =>
    editable &&
    (isAdmin ||
      (user?.role === "finance" &&
        (user.authorizedDepartmentIds ?? [user.departmentId]).includes(department.departmentId)));

  return (
    <Stack spacing={3}>
      <BackLink to="/budgets" label="Budgets" />

      <PageHeader
        title={budget.name}
        chips={<Chip size="small" label={budget.status.toUpperCase()} color={budget.status === "active" ? "success" : "default"} />}
        description={`${formatDate(budget.startDate)} – ${formatDate(budget.endDate)}`}
        actions={isAdmin && (editable || budget.status === "closed") ? (
          <>
            {isAdmin && editable && (
              <Stack direction="row" spacing={1}>
                {budget.status === "draft" && (
                  <Button
                    variant="contained"
                    disabled={activating}
                    onClick={() => run(() => activateBudget(budget.id).unwrap(), "Budget activated.", "Unable to activate the budget.", {
                      title: "Activate budget",
                      message: `Activate "${budget.name}"? Spend will be tracked against it and employees can create expenses dated ${formatDate(budget.startDate)} – ${formatDate(budget.endDate)}.`,
                      confirmLabel: "Activate",
                    })}
                  >
                    Activate
                  </Button>
                )}
                {budget.status === "active" && (
                  <Button variant="outlined" disabled={closing} onClick={handleClose}>Close</Button>
                )}
                <Button onClick={() => navigate(`/budgets/${budget.id}/edit`)}>Edit</Button>
                <Button onClick={openRollover}>Start next period</Button>
              </Stack>
            )}
            {isAdmin && budget.status === "closed" && (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  disabled={reopening}
                  onClick={() => run(() => reopenBudget(budget.id).unwrap(), "Budget reopened.", "Unable to reopen the budget.", {
                    title: "Reopen budget",
                    message: `Reopen "${budget.name}"? It becomes active again, as long as no other active budget covers the same period.`,
                    confirmLabel: "Reopen",
                  })}
                >
                  Reopen
                </Button>
                <Button variant="contained" onClick={openRollover}>Start next period</Button>
              </Stack>
            )}
          </>
        ) : undefined}
      />

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      {periodEnded && isAdmin && (
        <Alert
          severity="warning"
          action={
            <Stack direction="row" spacing={1}>
              <Button color="inherit" size="small" onClick={handleClose}>Close</Button>
              <Button color="inherit" size="small" onClick={openRollover}>Start next period</Button>
            </Stack>
          }
        >
          This budget's period ended on {formatDate(budget.endDate)}. New expenses can't be created until a budget covering today is active.
        </Alert>
      )}
      {budget.status === "draft" && isAdmin && (
        <Alert severity="info">This budget is a draft. Allocate it, then activate it to start tracking spend.</Alert>
      )}

      {budget.viewScope === "ORGANIZATION" && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                <Typography variant="h6">Organization</Typography>
                <Typography color="text.secondary">
                  {formatCurrency(allocatedToDepartments)} allocated · {formatCurrency(Math.max(budget.amount - allocatedToDepartments, 0))} unallocated
                </Typography>
              </Stack>
              <BudgetProgress allocated={budget.amount} utilization={budget.utilization} />

              {isAdmin && editable && (
                <>
                  <Divider />
                  <Typography variant="subtitle2">Allocate to a department</Typography>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      select
                      label="Department"
                      value={departmentId}
                      onChange={(event) => {
                        setDepartmentId(event.target.value);
                        const current = budget.departmentAllocations.find((item) => item.departmentId === event.target.value);
                        setDepartmentAmount(current ? String(current.amount) : "");
                      }}
                      fullWidth
                    >
                      {departments.filter((department) => department.status === "active").map((department) => (
                        <MenuItem key={department.id} value={department.id}>{department.name}</MenuItem>
                      ))}
                    </TextField>
                    <TextField label="Amount (₹)" type="number" value={departmentAmount} onChange={(event) => setDepartmentAmount(event.target.value)} fullWidth slotProps={{ htmlInput: { min: 1 } }} />
                    <Button
                      variant="contained"
                      disabled={savingDepartment || !departmentId || Number(departmentAmount) <= 0}
                      onClick={async () => {
                        if (await run(
                          () => saveDepartment({ organizationBudgetId: budget.id, departmentId, amount: Number(departmentAmount) }).unwrap(),
                          "Department allocation saved.",
                          "Unable to save the department allocation.",
                          {
                            title: "Allocate to department",
                            message: `Allocate ${formatCurrency(Number(departmentAmount))} to ${departments.find((item) => item.id === departmentId)?.name ?? "this department"}?`,
                            confirmLabel: "Allocate",
                          },
                        )) {
                          setDepartmentId("");
                          setDepartmentAmount("");
                        }
                      }}
                    >
                      Save
                    </Button>
                  </Stack>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {budget.departmentAllocations.length === 0 ? (
        <Alert severity="info">
          {isAdmin ? "No departments have been allocated a share of this budget yet." : "No allocation within your scope."}
        </Alert>
      ) : (
        budget.departmentAllocations.map((department) => (
          <DepartmentSection
            key={department.id}
            budget={budget}
            department={department}
            canManage={canManageDepartment(department)}
            showDepartmentTotals={budget.viewScope !== "TEAM"}
            run={run}
          />
        ))
      )}

      <Dialog open={Boolean(rollover)} onClose={() => !rollingOver && setRollover(null)} fullWidth maxWidth="sm">
        <DialogTitle>Start next period</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Creates a draft budget with the same amount and the same department, team and expense-type allocations. Review it, then activate it.
            </Typography>
            <TextField label="Name" value={rollover?.name ?? ""} onChange={(event) => setRollover((current) => current && { ...current, name: event.target.value })} fullWidth />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Start date" type="date" value={rollover?.startDate ?? ""} onChange={(event) => setRollover((current) => current && { ...current, startDate: event.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="End date" type="date" value={rollover?.endDate ?? ""} onChange={(event) => setRollover((current) => current && { ...current, endDate: event.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRollover(null)} disabled={rollingOver}>Not now</Button>
          <Button
            variant="contained"
            disabled={rollingOver || !rollover?.name.trim() || !rollover.startDate || !rollover.endDate || rollover.startDate > rollover.endDate}
            onClick={async () => {
              if (!rollover) return;
              try {
                const created = await rolloverBudget({ id: budget.id, ...rollover, name: rollover.name.trim() }).unwrap();
                setRollover(null);
                navigate(`/budgets/${created.id}`);
              } catch (caught) {
                setRollover(null);
                setError(getApiErrorMessage(caught, "Unable to start the next period."));
              }
            }}
          >
            Create draft
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function DepartmentSection({ budget, department, canManage, showDepartmentTotals, run }: {
  budget: OrganizationBudgetView;
  department: DepartmentBudgetView;
  canManage: boolean;
  showDepartmentTotals: boolean;
  run: Runner;
}) {
  const [saveTeam, { isLoading: savingTeam }] = useUpsertTeamAllocationMutation();
  const [saveType, { isLoading: savingType }] = useUpsertExpenseTypeBudgetMutation();
  const [teamId, setTeamId] = useState("");
  const [teamAmount, setTeamAmount] = useState("");
  const [typeTeamAllocationId, setTypeTeamAllocationId] = useState("");
  const [expenseType, setExpenseType] = useState<ExpenseType>("TRAVEL");
  const [typeAmount, setTypeAmount] = useState("");

  const allocatedToTeams = department.teamAllocations.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          {showDepartmentTotals ? (
            <>
              <Stack direction="row" sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                <Typography variant="h6">{department.departmentName}</Typography>
                <Typography color="text.secondary">
                  {formatCurrency(allocatedToTeams)} assigned to teams · {formatCurrency(Math.max(department.amount - allocatedToTeams, 0))} unassigned
                </Typography>
              </Stack>
              <BudgetProgress allocated={department.amount} utilization={department.utilization} />
            </>
          ) : (
            <Typography variant="h6">{department.departmentName}</Typography>
          )}

          <Divider />
          <Typography variant="subtitle2">Teams</Typography>
          {department.teamAllocations.length === 0 && (
            <Typography variant="body2" color="text.secondary">No team budgets yet.</Typography>
          )}
          {department.teamAllocations.map((team) => {
            const typeTotal = team.expenseTypeBudgets.reduce((sum, item) => sum + item.amount, 0);
            return (
              <Stack key={team.id} spacing={1} sx={{ pl: { sm: 1 } }}>
                <Stack direction="row" sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{team.teamName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatCurrency(typeTotal)} set for expense types
                  </Typography>
                </Stack>
                <BudgetProgress allocated={team.amount} utilization={team.utilization} dense />
                {team.expenseTypeBudgets.length > 0 && (
                  <Stack spacing={1} sx={{ pl: 2, borderLeft: 2, borderColor: "divider" }}>
                    {team.expenseTypeBudgets.map((typeBudget) => (
                      <Stack key={typeBudget.id} spacing={0.5}>
                        <Typography variant="body2">{EXPENSE_TYPE_LABELS[typeBudget.expenseType] ?? typeBudget.expenseType}</Typography>
                        <BudgetProgress allocated={typeBudget.amount} utilization={typeBudget.utilization} dense />
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Stack>
            );
          })}

          {department.expenseTypeBudgets.length > 0 && (
            <>
              <Divider />
              <Typography variant="subtitle2">Department-level expense-type budgets (legacy)</Typography>
              {department.expenseTypeBudgets.map((typeBudget) => (
                <Stack key={typeBudget.id} spacing={0.5}>
                  <Typography variant="body2">{EXPENSE_TYPE_LABELS[typeBudget.expenseType] ?? typeBudget.expenseType}</Typography>
                  <BudgetProgress allocated={typeBudget.amount} utilization={typeBudget.utilization} dense />
                </Stack>
              ))}
            </>
          )}

          {canManage && (
            <>
              <Divider />
              <Typography variant="subtitle2">Allocate to a team</Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  select
                  label="Team"
                  value={teamId}
                  onChange={(event) => {
                    setTeamId(event.target.value);
                    const current = department.teamAllocations.find((item) => item.teamId === event.target.value);
                    setTeamAmount(current ? String(current.amount) : "");
                  }}
                  fullWidth
                >
                  {department.departmentTeams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
                  ))}
                </TextField>
                <TextField label="Amount (₹)" type="number" value={teamAmount} onChange={(event) => setTeamAmount(event.target.value)} fullWidth slotProps={{ htmlInput: { min: 1 } }} />
                <Button
                  variant="contained"
                  disabled={savingTeam || !teamId || Number(teamAmount) <= 0}
                  onClick={async () => {
                    if (await run(
                      () => saveTeam({ organizationBudgetId: budget.id, departmentAllocationId: department.id, teamId, amount: Number(teamAmount) }).unwrap(),
                      "Team budget saved.",
                      "Unable to save the team budget.",
                      {
                        title: "Allocate to team",
                        message: `Allocate ${formatCurrency(Number(teamAmount))} to ${department.departmentTeams.find((team) => team.id === teamId)?.name ?? "this team"}?`,
                        confirmLabel: "Allocate",
                      },
                    )) {
                      setTeamId("");
                      setTeamAmount("");
                    }
                  }}
                >
                  Save
                </Button>
              </Stack>

              {department.teamAllocations.length > 0 && (
                <>
                  <Typography variant="subtitle2">Set a team's expense-type budget</Typography>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField select label="Team" value={typeTeamAllocationId} onChange={(event) => setTypeTeamAllocationId(event.target.value)} fullWidth>
                      {department.teamAllocations.map((team) => (
                        <MenuItem key={team.id} value={team.id}>{team.teamName} ({formatCurrency(team.amount)})</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Expense type"
                      value={expenseType}
                      onChange={(event) => {
                        const nextType = event.target.value as ExpenseType;
                        setExpenseType(nextType);
                        const current = department.teamAllocations
                          .find((item) => item.id === typeTeamAllocationId)
                          ?.expenseTypeBudgets.find((item) => item.expenseType === nextType);
                        setTypeAmount(current ? String(current.amount) : "");
                      }}
                      fullWidth
                    >
                      {EXPENSE_TYPES.map((type) => (
                        <MenuItem key={type} value={type}>{EXPENSE_TYPE_LABELS[type]}</MenuItem>
                      ))}
                    </TextField>
                    <TextField label="Amount (₹)" type="number" value={typeAmount} onChange={(event) => setTypeAmount(event.target.value)} fullWidth slotProps={{ htmlInput: { min: 1 } }} />
                    <Button
                      variant="contained"
                      disabled={savingType || !typeTeamAllocationId || Number(typeAmount) <= 0}
                      onClick={async () => {
                        if (await run(
                          () => saveType({ organizationBudgetId: budget.id, teamAllocationId: typeTeamAllocationId, expenseType, amount: Number(typeAmount) }).unwrap(),
                          `${EXPENSE_TYPE_LABELS[expenseType]} budget saved.`,
                          "Unable to save the expense-type budget.",
                          {
                            title: "Set expense-type budget",
                            message: `Set the ${EXPENSE_TYPE_LABELS[expenseType]} budget for ${department.teamAllocations.find((team) => team.id === typeTeamAllocationId)?.teamName ?? "this team"} to ${formatCurrency(Number(typeAmount))}?`,
                            confirmLabel: "Save",
                          },
                        )) {
                          setTypeAmount("");
                        }
                      }}
                    >
                      Save
                    </Button>
                  </Stack>
                </>
              )}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
