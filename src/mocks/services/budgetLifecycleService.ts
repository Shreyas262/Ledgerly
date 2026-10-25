import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type { BudgetStatus, OrganizationBudget } from "../../features/budgets/types/budget";
import { runAuditedTransaction } from "./auditService";
import {
  assertCanChangeBudget,
  budgetExceeded,
  findOverlappingActiveBudget,
  getPeriodChangeDenial,
  isPositiveAmount,
  loadBudgetHierarchy,
} from "./budgetService";
import { WorkflowError, workflowForbidden } from "./workflowErrors";
import { formatCurrency } from "../../utils/currency";

/**
 * Organization budget lifecycle (§28.3, §28.7, §28.9, §28.14): creating and
 * editing budgets, activating, closing and reopening them, starting the next
 * period and deleting drafts. Refusals are thrown as WorkflowError with the
 * status, code and message the API returns.
 */

export interface BudgetDetailsRequest {
  name?: string;
  description?: string;
  amount?: number;
  startDate?: string;
  endDate?: string;
}

export interface RolloverRequest {
  name?: string;
  startDate?: string;
  endDate?: string;
}

export type BudgetTransition = "activate" | "close" | "reopen";

const transitions: Record<BudgetTransition, { from: BudgetStatus; to: BudgetStatus; action: "BUDGET_ACTIVATED" | "BUDGET_CLOSED" | "BUDGET_REOPENED"; done: string; verb: string }> = {
  activate: { from: "draft", to: "active", action: "BUDGET_ACTIVATED", done: "Activated", verb: "activated" },
  close: { from: "active", to: "closed", action: "BUDGET_CLOSED", done: "Closed", verb: "closed" },
  // A mistakenly closed budget can be reopened by an administrator.
  reopen: { from: "closed", to: "active", action: "BUDGET_REOPENED", done: "Reopened", verb: "reopened" },
};

function invalid(message: string): WorkflowError {
  return new WorkflowError(422, "VALIDATION_ERROR", message);
}

function isValidPeriod(startDate: unknown, endDate: unknown): boolean {
  return (
    typeof startDate === "string" &&
    typeof endDate === "string" &&
    Boolean(startDate) &&
    Boolean(endDate) &&
    startDate <= endDate
  );
}

function validateName(name: unknown): asserts name is string {
  if (typeof name !== "string" || !name.trim()) throw invalid("Budget name is required.");
}

function validatePeriod(request: { startDate?: string; endDate?: string }): void {
  if (!isValidPeriod(request.startDate, request.endDate)) throw invalid("A valid budget period is required.");
}

function validateDetails(request: BudgetDetailsRequest): void {
  validateName(request.name);
  if (!isPositiveAmount(request.amount)) throw invalid("Budget amount must be greater than zero.");
  validatePeriod(request);
}

function assertAdministrator(principal: AuthenticatedPrincipal, message: string): void {
  if (principal.role !== "admin") throw workflowForbidden(message);
}

/** Admin: a new organization budget, created as a draft. */
export async function createBudget(
  principal: AuthenticatedPrincipal,
  request: BudgetDetailsRequest,
): Promise<OrganizationBudget> {
  assertAdministrator(principal, "Only administrators can create organization budgets.");
  validateDetails(request);

  const now = new Date().toISOString();
  const budget: OrganizationBudget = {
    id: crypto.randomUUID(),
    organizationId: principal.organizationId,
    name: request.name!.trim(),
    description: request.description?.trim() || undefined,
    amount: request.amount!,
    currency: "INR",
    startDate: request.startDate!,
    endDate: request.endDate!,
    status: "draft",
    createdBy: principal.userId,
    createdAt: now,
    updatedAt: now,
  };

  await runAuditedTransaction(["budgets"], {
    organizationId: budget.organizationId,
    actorId: principal.userId,
    action: "BUDGET_CREATED",
    entityType: "BUDGET",
    entityId: budget.id,
    newState: budget.status,
    metadata: { amount: budget.amount, currency: budget.currency },
    description: `Created organization budget ${budget.name}.`,
  }, (transaction) => transaction.objectStore("budgets").put(budget));

  return budget;
}

/**
 * Admin: edits the name, amount and period. The amount stays above the
 * department allocations, a period that has been active keeps its recorded
 * expenses (§28.13) and an active budget never overlaps another (§28.7).
 */
export async function updateBudget(
  principal: AuthenticatedPrincipal,
  existing: OrganizationBudget,
  request: BudgetDetailsRequest,
): Promise<OrganizationBudget> {
  assertCanChangeBudget(principal, existing, "organization");
  validateDetails(request);
  const amount = request.amount!;
  const startDate = request.startDate!;
  const endDate = request.endDate!;

  const { departmentAllocations } = await loadBudgetHierarchy();
  const allocated = departmentAllocations
    .filter((item) => item.organizationBudgetId === existing.id)
    .reduce((sum, item) => sum + item.amount, 0);
  if (allocated > amount) {
    throw budgetExceeded(`The organization budget cannot be lower than its department allocations (${formatCurrency(allocated)}).`);
  }

  const periodDenial = await getPeriodChangeDenial(existing, startDate, endDate);
  if (periodDenial) {
    throw new WorkflowError(422, "BUDGET_PERIOD_IN_USE", periodDenial, { businessRule: periodDenial });
  }

  if (existing.status === "active") {
    const overlapping = await findOverlappingActiveBudget(existing.organizationId, startDate, endDate, existing.id);
    if (overlapping) {
      throw new WorkflowError(409, "BUDGET_OVERLAP", `The period overlaps the active budget "${overlapping.name}". Only one active budget may cover a period.`);
    }
  }

  const updated: OrganizationBudget = {
    ...existing,
    name: request.name!.trim(),
    description: request.description?.trim() || undefined,
    amount,
    startDate,
    endDate,
    updatedAt: new Date().toISOString(),
  };

  await runAuditedTransaction(["budgets"], {
    organizationId: updated.organizationId,
    actorId: principal.userId,
    action: "BUDGET_UPDATED",
    entityType: "BUDGET",
    entityId: updated.id,
    previousState: existing.status,
    newState: updated.status,
    metadata: { previousAmount: existing.amount, newAmount: updated.amount },
    description: `Updated organization budget ${updated.name}.`,
  }, (transaction) => transaction.objectStore("budgets").put(updated));

  return updated;
}

/** Admin: activate a draft, close an active budget or reopen a closed one. */
export async function transitionBudget(
  principal: AuthenticatedPrincipal,
  budget: OrganizationBudget,
  transition: BudgetTransition,
): Promise<OrganizationBudget> {
  const { from, to, action, done, verb } = transitions[transition];
  assertAdministrator(principal, "Only administrators can activate, close or reopen organization budgets.");
  if (budget.status !== from) {
    throw new WorkflowError(409, "CONFLICT", `A ${budget.status} budget cannot be ${verb}.`);
  }

  // One active budget per period, so spending is never counted twice.
  if (to === "active") {
    const overlapping = await findOverlappingActiveBudget(budget.organizationId, budget.startDate, budget.endDate, budget.id);
    if (overlapping) {
      throw new WorkflowError(409, "BUDGET_OVERLAP", `The period overlaps the active budget "${overlapping.name}". Close it or change this budget's period first.`);
    }
  }

  const updated: OrganizationBudget = { ...budget, status: to, updatedAt: new Date().toISOString() };
  await runAuditedTransaction(["budgets"], {
    organizationId: budget.organizationId,
    actorId: principal.userId,
    action,
    entityType: "BUDGET",
    entityId: budget.id,
    previousState: budget.status,
    newState: to,
    description: `${done} organization budget ${budget.name}.`,
  }, (transaction) => transaction.objectStore("budgets").put(updated));

  return updated;
}

/**
 * Admin: starts the next period as a draft copy of the budget's allocations
 * (departments, teams and expense types) for review before activation (§28.9).
 */
export async function rolloverBudget(
  principal: AuthenticatedPrincipal,
  source: OrganizationBudget,
  request: RolloverRequest,
): Promise<OrganizationBudget> {
  assertAdministrator(principal, "Only administrators can start a new budget period.");
  validateName(request.name);
  validatePeriod(request);

  const { departmentAllocations, teamAllocations, expenseTypeBudgets } = await loadBudgetHierarchy();
  const now = new Date().toISOString();
  const budget: OrganizationBudget = {
    ...source,
    id: crypto.randomUUID(),
    name: request.name.trim(),
    startDate: request.startDate!,
    endDate: request.endDate!,
    status: "draft",
    createdBy: principal.userId,
    createdAt: now,
    updatedAt: now,
  };
  const departmentIdMap = new Map<string, string>();
  const teamIdMap = new Map<string, string>();
  const copiedDepartments = departmentAllocations
    .filter((item) => item.organizationBudgetId === source.id)
    .map((item) => {
      const id = crypto.randomUUID();
      departmentIdMap.set(item.id, id);
      return { ...item, id, organizationBudgetId: budget.id, createdAt: now, updatedAt: now };
    });
  const copiedTeams = teamAllocations
    .filter((item) => item.organizationBudgetId === source.id && departmentIdMap.has(item.departmentAllocationId))
    .map((item) => {
      const id = crypto.randomUUID();
      teamIdMap.set(item.id, id);
      return { ...item, id, organizationBudgetId: budget.id, departmentAllocationId: departmentIdMap.get(item.departmentAllocationId)!, createdAt: now, updatedAt: now };
    });
  const copiedTypes = expenseTypeBudgets
    .filter((item) => item.organizationBudgetId === source.id && item.teamAllocationId && teamIdMap.has(item.teamAllocationId))
    .map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      organizationBudgetId: budget.id,
      departmentAllocationId: departmentIdMap.get(item.departmentAllocationId) ?? item.departmentAllocationId,
      teamAllocationId: teamIdMap.get(item.teamAllocationId!),
      createdAt: now,
      updatedAt: now,
    }));

  await runAuditedTransaction(["budgets", "departmentBudgetAllocations", "teamBudgetAllocations", "expenseTypeBudgets"], {
    organizationId: budget.organizationId,
    actorId: principal.userId,
    action: "BUDGET_CREATED",
    entityType: "BUDGET",
    entityId: budget.id,
    newState: budget.status,
    metadata: { rolledOverFrom: source.id, amount: budget.amount, departmentAllocations: copiedDepartments.length, teamAllocations: copiedTeams.length, expenseTypeBudgets: copiedTypes.length },
    description: `Started the next budget period, ${budget.name}, from ${source.name}.`,
  }, (transaction) => {
    transaction.objectStore("budgets").put(budget);
    for (const item of copiedDepartments) transaction.objectStore("departmentBudgetAllocations").put(item);
    for (const item of copiedTeams) transaction.objectStore("teamBudgetAllocations").put(item);
    for (const item of copiedTypes) transaction.objectStore("expenseTypeBudgets").put(item);
  });

  return budget;
}

/**
 * §28.14: only a draft, which has never tracked spend, is deleted; a budget
 * that has been active is closed instead. Its allocations go with it.
 */
export async function deleteDraftBudget(principal: AuthenticatedPrincipal, budget: OrganizationBudget): Promise<void> {
  if (budget.status !== "draft") {
    throw new WorkflowError(409, "BUDGET_NOT_DRAFT", "Only draft budgets can be deleted. Close a budget that has been active instead.");
  }

  const { departmentAllocations, teamAllocations, expenseTypeBudgets } = await loadBudgetHierarchy();
  const ofBudget = <T extends { id: string; organizationBudgetId: string }>(items: T[]) =>
    items.filter((item) => item.organizationBudgetId === budget.id).map((item) => item.id);

  await runAuditedTransaction(
    ["budgets", "departmentBudgetAllocations", "teamBudgetAllocations", "expenseTypeBudgets"],
    {
      organizationId: budget.organizationId,
      actorId: principal.userId,
      action: "BUDGET_DELETED",
      entityType: "BUDGET",
      entityId: budget.id,
      previousState: budget.status,
      newState: "deleted",
      description: `Deleted draft budget ${budget.name}.`,
    },
    (transaction) => {
      transaction.objectStore("budgets").delete(budget.id);
      for (const id of ofBudget(departmentAllocations)) transaction.objectStore("departmentBudgetAllocations").delete(id);
      for (const id of ofBudget(teamAllocations)) transaction.objectStore("teamBudgetAllocations").delete(id);
      for (const id of ofBudget(expenseTypeBudgets)) transaction.objectStore("expenseTypeBudgets").delete(id);
    },
  );
}
