import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type {
  DepartmentBudgetAllocation,
  ExpenseTypeBudget,
  OrganizationBudget,
  TeamBudgetAllocation,
} from "../../features/budgets/types/budget";
import type { Department, Team } from "../../features/organizations/types/organization";
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS, type ExpenseType } from "../../features/expenses/types/expense";
import { runAuditedTransaction } from "./auditService";
import {
  assertCanChangeBudget,
  budgetExceeded,
  getAllocationSpend,
  isPositiveAmount,
  loadBudgetHierarchy,
} from "./budgetService";
import { getRecord } from "./mockDataService";
import { WorkflowError, workflowForbidden } from "./workflowErrors";
import { formatCurrency } from "../../utils/currency";

/**
 * Allocations down the budget hierarchy (§28.1–28.4): the organization budget
 * to departments (Admin), department allocations to teams and team
 * allocations to expense types (Finance for its authorized departments, or
 * Admin). Each level is capped by its parent, cannot fall below what is
 * allocated beneath it, nor below the spend already reimbursed against it.
 */

export interface DepartmentAllocationRequest {
  departmentId?: string;
  amount?: number;
}

export interface TeamAllocationRequest {
  departmentAllocationId?: string;
  teamId?: string;
  amount?: number;
}

export interface ExpenseTypeBudgetRequest {
  teamAllocationId?: string;
  expenseType?: ExpenseType;
  amount?: number;
}

const EXPENSE_TYPE_VALUES = new Set<string>(EXPENSE_TYPES);

function invalid(message: string): WorkflowError {
  return new WorkflowError(422, "VALIDATION_ERROR", message);
}

/** Admin manages any department; Finance only its authorized departments. */
function canManageDepartment(principal: AuthenticatedPrincipal, departmentId: string): boolean {
  if (principal.role === "admin") return true;
  return principal.role === "finance" && principal.authorizedDepartmentIds.includes(departmentId);
}

/** Admin: organization budget → department allocation. */
export async function allocateToDepartment(
  principal: AuthenticatedPrincipal,
  budget: OrganizationBudget,
  request: DepartmentAllocationRequest,
): Promise<void> {
  assertCanChangeBudget(principal, budget, "organization");
  const { departmentId, amount } = request;
  if (!departmentId || !isPositiveAmount(amount)) throw invalid("Select a department and enter an amount greater than zero.");

  const department = await getRecord<Department>("departments", departmentId);
  if (!department || department.organizationId !== budget.organizationId) throw invalid("Department does not belong to this organization.");

  const { departmentAllocations, teamAllocations, expenseTypeBudgets } = await loadBudgetHierarchy();
  const existing = departmentAllocations.find((item) => item.organizationBudgetId === budget.id && item.departmentId === departmentId);
  const allocatedElsewhere = departmentAllocations
    .filter((item) => item.organizationBudgetId === budget.id && item.id !== existing?.id)
    .reduce((sum, item) => sum + item.amount, 0);
  if (allocatedElsewhere + amount > budget.amount) {
    throw budgetExceeded(`Department allocations cannot exceed the organization budget. ${formatCurrency(budget.amount - allocatedElsewhere)} is still available.`);
  }

  if (existing) {
    const childTotal =
      teamAllocations.filter((item) => item.departmentAllocationId === existing.id).reduce((sum, item) => sum + item.amount, 0) +
      expenseTypeBudgets.filter((item) => item.departmentAllocationId === existing.id && !item.teamAllocationId).reduce((sum, item) => sum + item.amount, 0);
    if (childTotal > amount) {
      throw budgetExceeded(`The department allocation cannot be lower than what is already assigned to its teams (${formatCurrency(childTotal)}).`);
    }
  }

  const departmentSpend = await getAllocationSpend(budget, { departmentId });
  if (departmentSpend > amount) {
    throw budgetExceeded(`The department allocation cannot be lower than the ${formatCurrency(departmentSpend)} already reimbursed against it.`);
  }

  const now = new Date().toISOString();
  const allocation: DepartmentBudgetAllocation = {
    id: existing?.id ?? crypto.randomUUID(),
    organizationId: budget.organizationId,
    organizationBudgetId: budget.id,
    departmentId,
    amount,
    currency: budget.currency,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await runAuditedTransaction(["departmentBudgetAllocations"], {
    organizationId: budget.organizationId,
    actorId: principal.userId,
    action: "BUDGET_ALLOCATION_UPDATED",
    entityType: "BUDGET",
    entityId: allocation.id,
    metadata: { organizationBudgetId: budget.id, departmentId: allocation.departmentId, previousAmount: existing?.amount, newAmount: allocation.amount },
    description: `Allocated ${formatCurrency(allocation.amount)} to ${department.name}.`,
  }, (transaction) => transaction.objectStore("departmentBudgetAllocations").put(allocation));
}

/** Finance (authorized departments) or Admin: department allocation → team. */
export async function allocateToTeam(
  principal: AuthenticatedPrincipal,
  budget: OrganizationBudget,
  request: TeamAllocationRequest,
): Promise<void> {
  assertCanChangeBudget(principal, budget, "team");
  const { departmentAllocationId, teamId, amount } = request;
  if (!departmentAllocationId || !teamId || !isPositiveAmount(amount)) {
    throw invalid("Select a department allocation and team, and enter an amount greater than zero.");
  }

  const { departmentAllocations, teamAllocations, expenseTypeBudgets } = await loadBudgetHierarchy();
  const departmentAllocation = departmentAllocations.find((item) => item.id === departmentAllocationId && item.organizationBudgetId === budget.id);
  if (!departmentAllocation) throw invalid("The department has no allocation in this budget.");
  if (!canManageDepartment(principal, departmentAllocation.departmentId)) {
    throw workflowForbidden("You can only allocate budgets for your authorized departments.");
  }

  const team = await getRecord<Team>("teams", teamId);
  if (!team || team.departmentId !== departmentAllocation.departmentId) throw invalid("The team must belong to this department.");

  const existing = teamAllocations.find((item) => item.departmentAllocationId === departmentAllocation.id && item.teamId === team.id);
  const legacyTypeTotal = expenseTypeBudgets
    .filter((item) => item.departmentAllocationId === departmentAllocation.id && !item.teamAllocationId)
    .reduce((sum, item) => sum + item.amount, 0);
  const allocatedElsewhere = teamAllocations
    .filter((item) => item.departmentAllocationId === departmentAllocation.id && item.id !== existing?.id)
    .reduce((sum, item) => sum + item.amount, 0) + legacyTypeTotal;
  if (allocatedElsewhere + amount > departmentAllocation.amount) {
    throw budgetExceeded(`Team allocations cannot exceed the department allocation. ${formatCurrency(departmentAllocation.amount - allocatedElsewhere)} is still available.`);
  }
  if (existing) {
    const typeTotal = expenseTypeBudgets
      .filter((item) => item.teamAllocationId === existing.id)
      .reduce((sum, item) => sum + item.amount, 0);
    if (typeTotal > amount) {
      throw budgetExceeded(`The team allocation cannot be lower than its expense-type budgets (${formatCurrency(typeTotal)}).`);
    }
  }

  const teamSpend = await getAllocationSpend(budget, { departmentId: team.departmentId, teamId: team.id });
  if (teamSpend > amount) {
    throw budgetExceeded(`The team allocation cannot be lower than the ${formatCurrency(teamSpend)} already reimbursed against it.`);
  }

  const now = new Date().toISOString();
  const allocation: TeamBudgetAllocation = {
    id: existing?.id ?? crypto.randomUUID(),
    organizationId: budget.organizationId,
    organizationBudgetId: budget.id,
    departmentAllocationId: departmentAllocation.id,
    departmentId: departmentAllocation.departmentId,
    teamId: team.id,
    amount,
    currency: budget.currency,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await runAuditedTransaction(["teamBudgetAllocations"], {
    organizationId: budget.organizationId,
    actorId: principal.userId,
    action: "TEAM_BUDGET_ALLOCATION_UPDATED",
    entityType: "BUDGET",
    entityId: allocation.id,
    metadata: { organizationBudgetId: budget.id, departmentId: allocation.departmentId, teamId: team.id, previousAmount: existing?.amount, newAmount: allocation.amount },
    description: `Allocated ${formatCurrency(allocation.amount)} to team ${team.name}.`,
  }, (transaction) => transaction.objectStore("teamBudgetAllocations").put(allocation));
}

/** Finance (authorized departments) or Admin: team allocation → expense type. */
export async function setExpenseTypeBudget(
  principal: AuthenticatedPrincipal,
  budget: OrganizationBudget,
  request: ExpenseTypeBudgetRequest,
): Promise<void> {
  assertCanChangeBudget(principal, budget, "team");
  const { teamAllocationId, expenseType, amount } = request;
  if (!teamAllocationId || !expenseType || !EXPENSE_TYPE_VALUES.has(expenseType) || !isPositiveAmount(amount)) {
    throw invalid("Select a team allocation and expense type, and enter an amount greater than zero.");
  }

  const { teamAllocations, expenseTypeBudgets } = await loadBudgetHierarchy();
  const teamAllocation = teamAllocations.find((item) => item.id === teamAllocationId && item.organizationBudgetId === budget.id);
  if (!teamAllocation) throw invalid("The team has no allocation in this budget.");
  if (!canManageDepartment(principal, teamAllocation.departmentId)) {
    throw workflowForbidden("You can only set budgets for your authorized departments.");
  }

  const existing = expenseTypeBudgets.find((item) => item.teamAllocationId === teamAllocation.id && item.expenseType === expenseType);
  const allocatedElsewhere = expenseTypeBudgets
    .filter((item) => item.teamAllocationId === teamAllocation.id && item.id !== existing?.id)
    .reduce((sum, item) => sum + item.amount, 0);
  if (allocatedElsewhere + amount > teamAllocation.amount) {
    throw budgetExceeded(`Expense-type budgets cannot exceed the team allocation. ${formatCurrency(teamAllocation.amount - allocatedElsewhere)} is still available.`);
  }

  const typeSpend = await getAllocationSpend(budget, {
    departmentId: teamAllocation.departmentId,
    teamId: teamAllocation.teamId,
    expenseType,
  });
  if (typeSpend > amount) {
    throw budgetExceeded(`The expense-type budget cannot be lower than the ${formatCurrency(typeSpend)} already reimbursed against it.`);
  }

  const now = new Date().toISOString();
  const typeBudget: ExpenseTypeBudget = {
    id: existing?.id ?? crypto.randomUUID(),
    organizationId: budget.organizationId,
    organizationBudgetId: budget.id,
    departmentAllocationId: teamAllocation.departmentAllocationId,
    departmentId: teamAllocation.departmentId,
    teamAllocationId: teamAllocation.id,
    teamId: teamAllocation.teamId,
    expenseType,
    amount,
    currency: budget.currency,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const teamName = (await getRecord<{ name: string }>("teams", teamAllocation.teamId))?.name ?? "a team";

  await runAuditedTransaction(["expenseTypeBudgets"], {
    organizationId: budget.organizationId,
    actorId: principal.userId,
    action: "EXPENSE_TYPE_BUDGET_UPDATED",
    entityType: "BUDGET",
    entityId: typeBudget.id,
    metadata: { organizationBudgetId: budget.id, teamId: teamAllocation.teamId, expenseType, previousAmount: existing?.amount, newAmount: amount },
    description: `Set the ${EXPENSE_TYPE_LABELS[expenseType]} budget for ${teamName} to ${formatCurrency(amount)}.`,
  }, (transaction) => transaction.objectStore("expenseTypeBudgets").put(typeBudget));
}
