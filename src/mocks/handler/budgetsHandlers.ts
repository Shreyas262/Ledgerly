import { apiError } from "../services/apiError";
import { applyCollectionQuery, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";

import { EXPENSE_TYPE_LABELS, type ExpenseType } from "../../features/expenses/types/expense";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type {
  BudgetStatus,
  DepartmentBudgetAllocation,
  ExpenseTypeBudget,
  OrganizationBudget,
  TeamBudgetAllocation,
} from "../../features/budgets/types/budget";
import { authorizeRequest } from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { runAuditedTransaction } from "../services/auditService";
import { getRecord, listRecords } from "../services/mockDataService";
import {
  buildBudgetView,
  getExpenseCreationEligibility,
  findOverlappingActiveBudget,
  isBudgetVisibleTo,
  loadBudgetHierarchy,
} from "../services/budgetService";
import { resolveAuthenticatedPrincipal } from "../services/authorizationService";
import type { Department, Team } from "../../features/organizations/types/organization";

function badRequest(message: string) {
  return apiError(422, message, "VALIDATION_ERROR");
}

function conflict(message: string, code = "CONFLICT") {
  return apiError(409, message, code);
}

function forbidden(message: string) {
  return apiError(403, message, "FORBIDDEN");
}

// §28.5: allocations that break the hierarchy are business-rule failures.
function budgetExceeded(message: string) {
  return apiError(422, message, "BUDGET_EXCEEDED", { businessRule: message });
}

const EXPENSE_TYPES = new Set<ExpenseType>([
  "MEALS",
  "TRAVEL",
  "ACCOMMODATION",
  "TRANSPORTATION",
  "ENTERTAINMENT",
  "OFFICE_SUPPLIES",
  "COMMUNICATION",
  "TRAINING",
  "OTHER",
]);

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

function validateMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validateDates(startDate: unknown, endDate: unknown): boolean {
  return (
    typeof startDate === "string" &&
    typeof endDate === "string" &&
    Boolean(startDate) &&
    Boolean(endDate) &&
    startDate <= endDate
  );
}

type BudgetTransition = "activate" | "close" | "reopen";

const transitions: Record<BudgetTransition, { from: BudgetStatus; to: BudgetStatus }> = {
  activate: { from: "draft", to: "active" },
  close: { from: "active", to: "closed" },
  // A mistakenly closed budget can be reopened by an administrator.
  reopen: { from: "closed", to: "active" },
};

/** Admin manages any department; Finance only its authorized departments. */
function canManageDepartment(principal: AuthenticatedPrincipal, departmentId: string): boolean {
  if (principal.role === "admin") return true;
  return principal.role === "finance" && principal.authorizedDepartmentIds.includes(departmentId);
}

async function authorizeBudgetRead(request: Request, budget: OrganizationBudget) {
  const authorization = await authorizeRequest(request, {
    permission: "budgets.read",
    scope: "ORGANIZATION",
    resource: { organizationId: budget.organizationId },
  });
  if (!authorization.allowed) return { error: authorizationError(authorization) } as const;
  if (!(await isBudgetVisibleTo(authorization.principal, budget))) {
    return { error: forbidden("This budget has no allocation within your scope.") } as const;
  }
  return { principal: authorization.principal } as const;
}

async function authorizeBudgetUpdate(request: Request, budget: OrganizationBudget, adminOnly: boolean) {
  const authorization = await authorizeRequest(request, {
    permission: "budgets.update",
    scope: "ORGANIZATION",
    resource: { organizationId: budget.organizationId },
  });
  if (!authorization.allowed) return { error: authorizationError(authorization) } as const;
  const { principal } = authorization;
  if (adminOnly && principal.role !== "admin") {
    return { error: forbidden("Only administrators can manage organization budgets and department allocations.") } as const;
  }
  if (!adminOnly && principal.role !== "admin" && principal.role !== "finance") {
    return { error: forbidden("Only Finance users and administrators manage team and expense-type budgets.") } as const;
  }
  if (budget.status === "closed") return { error: conflict("Closed budgets cannot be changed.") } as const;
  return { principal } as const;
}

export const budgetsHandlers = [
  // Any signed-in user: whether expenses can be created today. Expenses may be
  // created only while an active budget covers the current date.
  http.get("/api/budgets/active-period", async ({ request }) => {
    const principal = await resolveAuthenticatedPrincipal(request);
    if (!principal) return apiError(401, "Please sign in to continue.");
    const { budget, allowed, reason } = await getExpenseCreationEligibility(principal);
    return HttpResponse.json({
      data: budget ? { name: budget.name, startDate: budget.startDate, endDate: budget.endDate } : null,
      canCreateExpense: allowed,
      reason: reason ?? null,
    });
  }),

  http.get("/api/budgets", async ({ request }) => {
    const authorization = await authorizeRequest(request, { permission: "budgets.read", scope: "ORGANIZATION" });
    if (!authorization.allowed) return authorizationError(authorization);
    const { principal } = authorization;

    const budgets = (await listRecords<OrganizationBudget>("budgets"))
      .filter((budget) => budget.organizationId === principal.organizationId);
    const visible: OrganizationBudget[] = [];
    for (const budget of budgets) {
      if (await isBudgetVisibleTo(principal, budget)) visible.push(budget);
    }
    // Active first, then newest period first.
    const order: Record<BudgetStatus, number> = { active: 0, draft: 1, closed: 2 };
    visible.sort((left, right) => order[left.status] - order[right.status] || right.startDate.localeCompare(left.startDate));

    const views = await Promise.all(visible.map((budget) => buildBudgetView(budget, principal)));
    return HttpResponse.json(applyCollectionQuery(views, parseCollectionQuery(request)));
  }),

  http.get("/api/budgets/:id", async ({ params, request }) => {
    const budget = await getRecord<OrganizationBudget>("budgets", String(params.id));
    if (!budget) return apiError(404, "Budget not found.");
    const access = await authorizeBudgetRead(request, budget);
    if ("error" in access) return access.error;
    return HttpResponse.json(await buildBudgetView(budget, access.principal));
  }),

  http.post("/api/budgets", async ({ request }) => {
    const authorization = await authorizeRequest(request, { permission: "budgets.create", scope: "ORGANIZATION" });
    if (!authorization.allowed) return authorizationError(authorization);
    if (authorization.principal.role !== "admin") {
      return forbidden("Only administrators can create organization budgets.");
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      amount?: number;
      startDate?: string;
      endDate?: string;
    };
    if (typeof body.name !== "string" || !body.name.trim()) return badRequest("Budget name is required.");
    if (!validateMoney(body.amount)) return badRequest("Budget amount must be greater than zero.");
    if (!validateDates(body.startDate, body.endDate)) return badRequest("A valid budget period is required.");

    const now = new Date().toISOString();
    const budget: OrganizationBudget = {
      id: crypto.randomUUID(),
      organizationId: authorization.principal.organizationId,
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
      amount: body.amount,
      currency: "INR",
      startDate: body.startDate!,
      endDate: body.endDate!,
      status: "draft",
      createdBy: authorization.principal.userId,
      createdAt: now,
      updatedAt: now,
    };

    await runAuditedTransaction(["budgets"], {
      organizationId: budget.organizationId,
      actorId: authorization.principal.userId,
      action: "BUDGET_CREATED",
      entityType: "BUDGET",
      entityId: budget.id,
      newState: budget.status,
      metadata: { amount: budget.amount, currency: budget.currency },
      description: `Created organization budget ${budget.name}.`,
    }, (transaction) => transaction.objectStore("budgets").put(budget));

    return HttpResponse.json(await buildBudgetView(budget, authorization.principal), { status: 201 });
  }),

  http.put("/api/budgets/:id", async ({ params, request }) => {
    const existing = await getRecord<OrganizationBudget>("budgets", String(params.id));
    if (!existing) return apiError(404, "Budget not found.");
    const access = await authorizeBudgetUpdate(request, existing, true);
    if ("error" in access) return access.error;

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      amount?: number;
      startDate?: string;
      endDate?: string;
    };
    if (typeof body.name !== "string" || !body.name.trim()) return badRequest("Budget name is required.");
    if (!validateMoney(body.amount)) return badRequest("Budget amount must be greater than zero.");
    if (!validateDates(body.startDate, body.endDate)) return badRequest("A valid budget period is required.");

    const { departmentAllocations } = await loadBudgetHierarchy();
    const allocated = departmentAllocations
      .filter((item) => item.organizationBudgetId === existing.id)
      .reduce((sum, item) => sum + item.amount, 0);
    if (allocated > body.amount) {
      return budgetExceeded(`The organization budget cannot be lower than its department allocations (${money(allocated)}).`);
    }

    if (existing.status === "active") {
      const overlapping = await findOverlappingActiveBudget(existing.organizationId, body.startDate!, body.endDate!, existing.id);
      if (overlapping) {
        return conflict(`The period overlaps the active budget "${overlapping.name}". Only one active budget may cover a period.`, "BUDGET_OVERLAP");
      }
    }

    const updated: OrganizationBudget = {
      ...existing,
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
      amount: body.amount,
      startDate: body.startDate!,
      endDate: body.endDate!,
      updatedAt: new Date().toISOString(),
    };

    await runAuditedTransaction(["budgets"], {
      organizationId: updated.organizationId,
      actorId: access.principal.userId,
      action: "BUDGET_UPDATED",
      entityType: "BUDGET",
      entityId: updated.id,
      previousState: existing.status,
      newState: updated.status,
      metadata: { previousAmount: existing.amount, newAmount: updated.amount },
      description: `Updated organization budget ${updated.name}.`,
    }, (transaction) => transaction.objectStore("budgets").put(updated));

    return HttpResponse.json(await buildBudgetView(updated, access.principal));
  }),

  http.post("/api/budgets/:id/activate", async ({ params, request }) =>
    transitionBudget(String(params.id), request, "activate")),

  http.post("/api/budgets/:id/close", async ({ params, request }) =>
    transitionBudget(String(params.id), request, "close")),

  http.post("/api/budgets/:id/reopen", async ({ params, request }) =>
    transitionBudget(String(params.id), request, "reopen")),

  // Starts the next period as a draft copy of the budget's allocations
  // (departments, teams and expense types) for review before activation.
  http.post("/api/budgets/:id/rollover", async ({ params, request }) => {
    const source = await getRecord<OrganizationBudget>("budgets", String(params.id));
    if (!source) return apiError(404, "Budget not found.");
    const authorization = await authorizeRequest(request, { permission: "budgets.create", scope: "ORGANIZATION", resource: { organizationId: source.organizationId } });
    if (!authorization.allowed) return authorizationError(authorization);
    if (authorization.principal.role !== "admin") return forbidden("Only administrators can start a new budget period.");

    const body = (await request.json().catch(() => ({}))) as { name?: string; startDate?: string; endDate?: string };
    if (typeof body.name !== "string" || !body.name.trim()) return badRequest("Budget name is required.");
    if (!validateDates(body.startDate, body.endDate)) return badRequest("A valid budget period is required.");

    const { departmentAllocations, teamAllocations, expenseTypeBudgets } = await loadBudgetHierarchy();
    const now = new Date().toISOString();
    const budget: OrganizationBudget = {
      ...source,
      id: crypto.randomUUID(),
      name: body.name.trim(),
      startDate: body.startDate!,
      endDate: body.endDate!,
      status: "draft",
      createdBy: authorization.principal.userId,
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
      actorId: authorization.principal.userId,
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

    return HttpResponse.json(await buildBudgetView(budget, authorization.principal), { status: 201 });
  }),

  // Admin: organization budget → department allocation.
  http.post("/api/budgets/:id/departments", async ({ params, request }) => {
    const budget = await getRecord<OrganizationBudget>("budgets", String(params.id));
    if (!budget) return apiError(404, "Budget not found.");
    const access = await authorizeBudgetUpdate(request, budget, true);
    if ("error" in access) return access.error;

    const body = (await request.json().catch(() => ({}))) as { departmentId?: string; amount?: number };
    if (!body.departmentId || !validateMoney(body.amount)) return badRequest("Select a department and enter an amount greater than zero.");

    const department = await getRecord<Department>("departments", body.departmentId);
    if (!department || department.organizationId !== budget.organizationId) return badRequest("Department does not belong to this organization.");

    const { departmentAllocations, teamAllocations, expenseTypeBudgets } = await loadBudgetHierarchy();
    const existing = departmentAllocations.find((item) => item.organizationBudgetId === budget.id && item.departmentId === body.departmentId);
    const allocatedElsewhere = departmentAllocations
      .filter((item) => item.organizationBudgetId === budget.id && item.id !== existing?.id)
      .reduce((sum, item) => sum + item.amount, 0);
    if (allocatedElsewhere + body.amount > budget.amount) {
      return budgetExceeded(`Department allocations cannot exceed the organization budget. ${money(budget.amount - allocatedElsewhere)} is still available.`);
    }

    if (existing) {
      const childTotal =
        teamAllocations.filter((item) => item.departmentAllocationId === existing.id).reduce((sum, item) => sum + item.amount, 0) +
        expenseTypeBudgets.filter((item) => item.departmentAllocationId === existing.id && !item.teamAllocationId).reduce((sum, item) => sum + item.amount, 0);
      if (childTotal > body.amount) {
        return budgetExceeded(`The department allocation cannot be lower than what is already assigned to its teams (${money(childTotal)}).`);
      }
    }

    const now = new Date().toISOString();
    const allocation: DepartmentBudgetAllocation = {
      id: existing?.id ?? crypto.randomUUID(),
      organizationId: budget.organizationId,
      organizationBudgetId: budget.id,
      departmentId: body.departmentId,
      amount: body.amount,
      currency: budget.currency,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await runAuditedTransaction(["departmentBudgetAllocations"], {
      organizationId: budget.organizationId,
      actorId: access.principal.userId,
      action: "BUDGET_ALLOCATION_UPDATED",
      entityType: "BUDGET",
      entityId: allocation.id,
      metadata: { organizationBudgetId: budget.id, departmentId: allocation.departmentId, previousAmount: existing?.amount, newAmount: allocation.amount },
      description: `Allocated ${money(allocation.amount)} to ${department.name}.`,
    }, (transaction) => transaction.objectStore("departmentBudgetAllocations").put(allocation));

    return HttpResponse.json(await buildBudgetView(budget, access.principal));
  }),

  // Finance (authorized departments) or admin: department allocation → team.
  http.post("/api/budgets/:id/teams", async ({ params, request }) => {
    const budget = await getRecord<OrganizationBudget>("budgets", String(params.id));
    if (!budget) return apiError(404, "Budget not found.");
    const access = await authorizeBudgetUpdate(request, budget, false);
    if ("error" in access) return access.error;

    const body = (await request.json().catch(() => ({}))) as { departmentAllocationId?: string; teamId?: string; amount?: number };
    if (!body.departmentAllocationId || !body.teamId || !validateMoney(body.amount)) {
      return badRequest("Select a department allocation and team, and enter an amount greater than zero.");
    }

    const { departmentAllocations, teamAllocations, expenseTypeBudgets } = await loadBudgetHierarchy();
    const departmentAllocation = departmentAllocations.find((item) => item.id === body.departmentAllocationId && item.organizationBudgetId === budget.id);
    if (!departmentAllocation) return badRequest("The department has no allocation in this budget.");
    if (!canManageDepartment(access.principal, departmentAllocation.departmentId)) {
      return forbidden("You can only allocate budgets for your authorized departments.");
    }

    const team = await getRecord<Team>("teams", body.teamId);
    if (!team || team.departmentId !== departmentAllocation.departmentId) {
      return badRequest("The team must belong to this department.");
    }

    const existing = teamAllocations.find((item) => item.departmentAllocationId === departmentAllocation.id && item.teamId === team.id);
    const legacyTypeTotal = expenseTypeBudgets
      .filter((item) => item.departmentAllocationId === departmentAllocation.id && !item.teamAllocationId)
      .reduce((sum, item) => sum + item.amount, 0);
    const allocatedElsewhere = teamAllocations
      .filter((item) => item.departmentAllocationId === departmentAllocation.id && item.id !== existing?.id)
      .reduce((sum, item) => sum + item.amount, 0) + legacyTypeTotal;
    if (allocatedElsewhere + body.amount > departmentAllocation.amount) {
      return budgetExceeded(`Team allocations cannot exceed the department allocation. ${money(departmentAllocation.amount - allocatedElsewhere)} is still available.`);
    }
    if (existing) {
      const typeTotal = expenseTypeBudgets
        .filter((item) => item.teamAllocationId === existing.id)
        .reduce((sum, item) => sum + item.amount, 0);
      if (typeTotal > body.amount) {
        return budgetExceeded(`The team allocation cannot be lower than its expense-type budgets (${money(typeTotal)}).`);
      }
    }

    const now = new Date().toISOString();
    const allocation: TeamBudgetAllocation = {
      id: existing?.id ?? crypto.randomUUID(),
      organizationId: budget.organizationId,
      organizationBudgetId: budget.id,
      departmentAllocationId: departmentAllocation.id,
      departmentId: departmentAllocation.departmentId,
      teamId: team.id,
      amount: body.amount,
      currency: budget.currency,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await runAuditedTransaction(["teamBudgetAllocations"], {
      organizationId: budget.organizationId,
      actorId: access.principal.userId,
      action: "TEAM_BUDGET_ALLOCATION_UPDATED",
      entityType: "BUDGET",
      entityId: allocation.id,
      metadata: { organizationBudgetId: budget.id, departmentId: allocation.departmentId, teamId: team.id, previousAmount: existing?.amount, newAmount: allocation.amount },
      description: `Allocated ${money(allocation.amount)} to team ${team.name}.`,
    }, (transaction) => transaction.objectStore("teamBudgetAllocations").put(allocation));

    return HttpResponse.json(await buildBudgetView(budget, access.principal));
  }),

  // Finance (authorized departments) or admin: team allocation → expense type.
  http.post("/api/budgets/:id/expense-types", async ({ params, request }) => {
    const budget = await getRecord<OrganizationBudget>("budgets", String(params.id));
    if (!budget) return apiError(404, "Budget not found.");
    const access = await authorizeBudgetUpdate(request, budget, false);
    if ("error" in access) return access.error;

    const body = (await request.json().catch(() => ({}))) as { teamAllocationId?: string; expenseType?: ExpenseType; amount?: number };
    if (!body.teamAllocationId || !body.expenseType || !EXPENSE_TYPES.has(body.expenseType) || !validateMoney(body.amount)) {
      return badRequest("Select a team allocation and expense type, and enter an amount greater than zero.");
    }

    const { teamAllocations, expenseTypeBudgets } = await loadBudgetHierarchy();
    const teamAllocation = teamAllocations.find((item) => item.id === body.teamAllocationId && item.organizationBudgetId === budget.id);
    if (!teamAllocation) return badRequest("The team has no allocation in this budget.");
    if (!canManageDepartment(access.principal, teamAllocation.departmentId)) {
      return forbidden("You can only set budgets for your authorized departments.");
    }

    const existing = expenseTypeBudgets.find((item) => item.teamAllocationId === teamAllocation.id && item.expenseType === body.expenseType);
    const allocatedElsewhere = expenseTypeBudgets
      .filter((item) => item.teamAllocationId === teamAllocation.id && item.id !== existing?.id)
      .reduce((sum, item) => sum + item.amount, 0);
    if (allocatedElsewhere + body.amount > teamAllocation.amount) {
      return budgetExceeded(`Expense-type budgets cannot exceed the team allocation. ${money(teamAllocation.amount - allocatedElsewhere)} is still available.`);
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
      expenseType: body.expenseType,
      amount: body.amount,
      currency: budget.currency,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await runAuditedTransaction(["expenseTypeBudgets"], {
      organizationId: budget.organizationId,
      actorId: access.principal.userId,
      action: "EXPENSE_TYPE_BUDGET_UPDATED",
      entityType: "BUDGET",
      entityId: typeBudget.id,
      metadata: { organizationBudgetId: budget.id, teamId: teamAllocation.teamId, expenseType: body.expenseType, previousAmount: existing?.amount, newAmount: body.amount },
      description: `Set the ${EXPENSE_TYPE_LABELS[body.expenseType as ExpenseType] ?? body.expenseType} budget for ${(await getRecord<{ name: string }>("teams", teamAllocation.teamId))?.name ?? "a team"} to ${money(body.amount)}.`,
    }, (transaction) => transaction.objectStore("expenseTypeBudgets").put(typeBudget));

    return HttpResponse.json(await buildBudgetView(budget, access.principal));
  }),
];

async function transitionBudget(budgetId: string, request: Request, transition: BudgetTransition) {
  const { from, to: nextStatus } = transitions[transition];
  const budget = await getRecord<OrganizationBudget>("budgets", budgetId);
  if (!budget) return apiError(404, "Budget not found.");

  const authorization = await authorizeRequest(request, {
    permission: "budgets.update",
    scope: "ORGANIZATION",
    resource: { organizationId: budget.organizationId },
  });
  if (!authorization.allowed) return authorizationError(authorization);
  if (authorization.principal.role !== "admin") return forbidden("Only administrators can activate, close or reopen organization budgets.");
  if (budget.status !== from) {
    return conflict(`A ${budget.status} budget cannot be ${transition === "activate" ? "activated" : transition === "close" ? "closed" : "reopened"}.`);
  }

  // One active budget per period, so spending is never counted twice.
  if (nextStatus === "active") {
    const overlapping = await findOverlappingActiveBudget(budget.organizationId, budget.startDate, budget.endDate, budget.id);
    if (overlapping) {
      return conflict(`The period overlaps the active budget "${overlapping.name}". Close it or change this budget's period first.`, "BUDGET_OVERLAP");
    }
  }

  const updated: OrganizationBudget = { ...budget, status: nextStatus, updatedAt: new Date().toISOString() };
  await runAuditedTransaction(["budgets"], {
    organizationId: budget.organizationId,
    actorId: authorization.principal.userId,
    action: transition === "activate" ? "BUDGET_ACTIVATED" : transition === "close" ? "BUDGET_CLOSED" : "BUDGET_REOPENED",
    entityType: "BUDGET",
    entityId: budget.id,
    previousState: budget.status,
    newState: nextStatus,
    description: `${transition === "activate" ? "Activated" : transition === "close" ? "Closed" : "Reopened"} organization budget ${budget.name}.`,
  }, (transaction) => transaction.objectStore("budgets").put(updated));

  return HttpResponse.json(await buildBudgetView(updated, authorization.principal));
}
