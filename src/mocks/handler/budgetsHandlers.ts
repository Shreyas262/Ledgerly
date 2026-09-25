import { apiError } from "../services/apiError";
import { applyCollectionQuery, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";

import type { ExpenseType } from "../../features/expenses/types/expense";
import type {
  BudgetStatus,
  DepartmentBudgetAllocation,
  ExpenseTypeBudget,
  OrganizationBudget,
  OrganizationBudgetView,
} from "../../features/budgets/types/budget";
import {
  authorizeRequest,
} from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { runAuditedTransaction } from "../services/auditService";
import { getRecord, listRecords } from "../services/mockDataService";
import type { Expense } from "../../features/expenses/types/expense";
import type { Department } from "../../features/organizations/types/organization";

const APPROVED_EXPENSE_STATES = new Set([
  "approved",
  "reimbursement_pending",
  "reimbursed",
]);


function badRequest(message: string) {
  return apiError(422, message, "VALIDATION_ERROR");
}

function conflict(message: string) {
  return apiError(409, message, "CONFLICT");
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

function isLifecycleTransitionAllowed(
  current: BudgetStatus,
  next: BudgetStatus,
): boolean {
  return (
    (current === "draft" && next === "active") ||
    (current === "active" && next === "closed")
  );
}

async function calculateExpenseSpend(
  organizationBudget: OrganizationBudget,
  departmentId?: string,
  expenseType?: ExpenseType,
): Promise<number> {
  const expenses = await listRecords<Expense>("expenses");

  return expenses.reduce((total, expense) => {
    if (expense.organizationId !== organizationBudget.organizationId) return total;
    if (expense.expenseDate < organizationBudget.startDate || expense.expenseDate > organizationBudget.endDate) return total;
    if (!APPROVED_EXPENSE_STATES.has(expense.status)) return total;
    if (departmentId && expense.departmentId !== departmentId) return total;
    if (expenseType && expense.type !== expenseType) return total;
    return total + expense.amount;
  }, 0);
}

async function buildBudgetView(
  organizationBudget: OrganizationBudget,
  visibleDepartmentIds?: readonly string[],
): Promise<OrganizationBudgetView> {
  const [departments, allocations, expenseTypeBudgets] = await Promise.all([
    listRecords<Department>("departments"),
    listRecords<DepartmentBudgetAllocation>("departmentBudgetAllocations"),
    listRecords<ExpenseTypeBudget>("expenseTypeBudgets"),
  ]);

  const organizationSpend = await calculateExpenseSpend(organizationBudget);
  const relevantAllocations = allocations.filter(
    (allocation) =>
      allocation.organizationBudgetId === organizationBudget.id &&
      (!visibleDepartmentIds || visibleDepartmentIds.includes(allocation.departmentId)),
  );

  const departmentAllocations = await Promise.all(
    relevantAllocations.map(async (allocation) => {
      const department = departments.find((item) => item.id === allocation.departmentId);
      const departmentSpend = await calculateExpenseSpend(
        organizationBudget,
        allocation.departmentId,
      );
      const childBudgets = expenseTypeBudgets.filter(
        (budget) =>
          budget.departmentAllocationId === allocation.id &&
          budget.departmentId === allocation.departmentId,
      );

      const expenseTypeViews = await Promise.all(
        childBudgets.map(async (budget) => {
          const spentAmount = await calculateExpenseSpend(
            organizationBudget,
            budget.departmentId,
            budget.expenseType,
          );
          return {
            ...budget,
            utilization: {
              spentAmount,
              remainingAmount: Math.max(budget.amount - spentAmount, 0),
              utilizationPercent: budget.amount > 0 ? (spentAmount / budget.amount) * 100 : 0,
            },
          };
        }),
      );

      return {
        ...allocation,
        departmentName: department?.name ?? allocation.departmentId,
        utilization: {
          spentAmount: departmentSpend,
          remainingAmount: Math.max(allocation.amount - departmentSpend, 0),
          utilizationPercent: allocation.amount > 0 ? (departmentSpend / allocation.amount) * 100 : 0,
        },
        expenseTypeBudgets: expenseTypeViews,
      };
    }),
  );

  return {
    ...organizationBudget,
    utilization: {
      spentAmount: organizationSpend,
      remainingAmount: Math.max(organizationBudget.amount - organizationSpend, 0),
      utilizationPercent:
        organizationBudget.amount > 0
          ? (organizationSpend / organizationBudget.amount) * 100
          : 0,
    },
    departmentAllocations,
  };
}

async function getBudgetForRequest(
  request: Request,
  id: string,
) {
  const budget = await getRecord<OrganizationBudget>("budgets", id);
  if (!budget) {
    return { budget: null, authorization: null };
  }

  const authorization = await authorizeRequest(request, {
    permission: "budgets.read",
    scope: "ORGANIZATION",
    resource: { organizationId: budget.organizationId },
  });

  return { budget, authorization };
}

export const budgetsHandlers = [
  http.get("/api/budgets", async ({ request }) => {
    const authorization = await authorizeRequest(request, {
      permission: "budgets.read",
      scope: "ORGANIZATION",
    });
    if (!authorization.allowed) return authorizationError(authorization);

    const budgets = await listRecords<OrganizationBudget>("budgets");
    const organizationBudgets = budgets.filter(
      (budget) => budget.organizationId === authorization.principal.organizationId,
    );
    const visibleDepartmentIds =
      authorization.principal.role === "finance"
        ? authorization.principal.authorizedDepartmentIds
        : undefined;

    const visibleBudgets = visibleDepartmentIds
      ? (await listRecords<DepartmentBudgetAllocation>("departmentBudgetAllocations"))
          .filter((allocation) => visibleDepartmentIds.includes(allocation.departmentId))
          .map((allocation) => allocation.organizationBudgetId)
          .filter((budgetId, index, ids) => ids.indexOf(budgetId) === index)
          .map((budgetId) => organizationBudgets.find((budget) => budget.id === budgetId))
          .filter((budget): budget is OrganizationBudget => Boolean(budget))
      : organizationBudgets;

    const views = await Promise.all(
      visibleBudgets.map((budget) => buildBudgetView(budget, visibleDepartmentIds)),
    );

    return HttpResponse.json(applyCollectionQuery(views, parseCollectionQuery(request)));
  }),

  http.get("/api/budgets/:id", async ({ params, request }) => {
    const { budget, authorization } = await getBudgetForRequest(request, String(params.id));
    if (!budget) return apiError(404, "Budget not found.");
    if (!authorization?.allowed) return authorizationError(authorization!);

    const visibleDepartmentIds =
      authorization.principal.role === "finance"
        ? authorization.principal.authorizedDepartmentIds
        : undefined;
    const view = await buildBudgetView(budget, visibleDepartmentIds);

    if (authorization.principal.role === "finance" && view.departmentAllocations.length === 0) {
      return authorizationError({
        allowed: false,
        status: 403,
        code: "FORBIDDEN",
        message: "You are not authorized to access this department budget.",
      });
    }

    return HttpResponse.json(view);
  }),

  http.post("/api/budgets", async ({ request }) => {
    const authorization = await authorizeRequest(request, {
      permission: "budgets.create",
      scope: "ORGANIZATION",
    });
    if (!authorization.allowed) return authorizationError(authorization);
    if (authorization.principal.role !== "admin") {
      return authorizationError({
        allowed: false,
        status: 403,
        code: "FORBIDDEN",
        message: "Only administrators can create organization budgets.",
      });
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

    return HttpResponse.json(await buildBudgetView(budget), { status: 201 });
  }),

  http.put("/api/budgets/:id", async ({ params, request }) => {
    const budgetId = String(params.id);
    const existing = await getRecord<OrganizationBudget>("budgets", budgetId);
    if (!existing) return apiError(404, "Budget not found.");

    const authorization = await authorizeRequest(request, {
      permission: "budgets.update",
      scope: "ORGANIZATION",
      resource: { organizationId: existing.organizationId, state: existing.status },
    });
    if (!authorization.allowed) return authorizationError(authorization);
    if (authorization.principal.role !== "admin") {
      return authorizationError({ allowed: false, status: 403, code: "FORBIDDEN", message: "Only administrators can manage organization budgets." });
    }
    if (existing.status === "closed") return conflict("Closed budgets are immutable.");

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

    const allocations = await listRecords<DepartmentBudgetAllocation>("departmentBudgetAllocations");
    const allocated = allocations
      .filter((item) => item.organizationBudgetId === existing.id)
      .reduce((sum, item) => sum + item.amount, 0);
    if (allocated > body.amount) return budgetExceeded("Organization budget cannot be lower than its department allocations.");

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
      actorId: authorization.principal.userId,
      action: "BUDGET_UPDATED",
      entityType: "BUDGET",
      entityId: updated.id,
      previousState: existing.status,
      newState: updated.status,
      metadata: { previousAmount: existing.amount, newAmount: updated.amount },
      description: `Updated organization budget ${updated.name}.`,
    }, (transaction) => transaction.objectStore("budgets").put(updated));

    return HttpResponse.json(await buildBudgetView(updated));
  }),

  http.post("/api/budgets/:id/activate", async ({ params, request }) =>
    transitionBudget(String(params.id), request, "active")),

  http.post("/api/budgets/:id/close", async ({ params, request }) =>
    transitionBudget(String(params.id), request, "closed")),

  http.post("/api/budgets/:id/departments", async ({ params, request }) => {
    const budgetId = String(params.id);
    const budget = await getRecord<OrganizationBudget>("budgets", budgetId);
    if (!budget) return apiError(404, "Budget not found.");

    const authorization = await authorizeRequest(request, {
      permission: "budgets.update",
      scope: "ORGANIZATION",
      resource: { organizationId: budget.organizationId, state: budget.status },
    });
    if (!authorization.allowed) return authorizationError(authorization);
    if (authorization.principal.role !== "admin") return authorizationError({ allowed: false, status: 403, code: "FORBIDDEN", message: "Only administrators can allocate organization budgets." });
    if (budget.status === "closed") return conflict("Closed budgets are immutable.");

    const body = (await request.json().catch(() => ({}))) as { departmentId?: string; amount?: number };
    if (!body.departmentId || !validateMoney(body.amount)) return badRequest("Department and allocation amount are required.");

    const department = await getRecord<Department>("departments", body.departmentId);
    if (!department || department.organizationId !== budget.organizationId) return badRequest("Department does not belong to this organization.");

    const allocations = await listRecords<DepartmentBudgetAllocation>("departmentBudgetAllocations");
    const existing = allocations.find((item) => item.organizationBudgetId === budget.id && item.departmentId === body.departmentId);
    const allocatedElsewhere = allocations
      .filter((item) => item.organizationBudgetId === budget.id && item.id !== existing?.id)
      .reduce((sum, item) => sum + item.amount, 0);
    if (allocatedElsewhere + body.amount > budget.amount) return budgetExceeded("Department allocations cannot exceed the organization budget.");

    if (existing) {
      const expenseTypeBudgets = await listRecords<ExpenseTypeBudget>("expenseTypeBudgets");
      const childTotal = expenseTypeBudgets
        .filter((item) => item.departmentAllocationId === existing.id)
        .reduce((sum, item) => sum + item.amount, 0);
      if (childTotal > body.amount) return budgetExceeded("Department allocation cannot be lower than its expense-type budgets.");
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
      actorId: authorization.principal.userId,
      action: "BUDGET_ALLOCATION_UPDATED",
      entityType: "BUDGET",
      entityId: allocation.id,
      metadata: { organizationBudgetId: budget.id, departmentId: allocation.departmentId, amount: allocation.amount },
      description: `Updated department budget allocation for ${department.name}.`,
    }, (transaction) => transaction.objectStore("departmentBudgetAllocations").put(allocation));

    return HttpResponse.json(await buildBudgetView(budget));
  }),

  http.post("/api/budgets/:id/expense-types", async ({ params, request }) => {
    const budgetId = String(params.id);
    const budget = await getRecord<OrganizationBudget>("budgets", budgetId);
    if (!budget) return apiError(404, "Budget not found.");

    const authorization = await authorizeRequest(request, {
      permission: "budgets.update",
      scope: "DEPARTMENT",
      resource: { organizationId: budget.organizationId, departmentId: (await resolveDepartmentFromBody(request)) ?? undefined, state: budget.status },
    });
    if (!authorization.allowed) return authorizationError(authorization);
    if (authorization.principal.role !== "finance") return authorizationError({ allowed: false, status: 403, code: "FORBIDDEN", message: "Only Finance users manage department expense-type budgets." });
    if (budget.status === "closed") return conflict("Closed budgets are immutable.");

    const body = (await request.clone().json().catch(() => ({}))) as { departmentAllocationId?: string; departmentId?: string; expenseType?: ExpenseType; amount?: number };
    if (!body.departmentAllocationId || !body.departmentId || !body.expenseType || !EXPENSE_TYPES.has(body.expenseType) || !validateMoney(body.amount)) return badRequest("Department allocation, expense type, and amount are required.");
    if (!authorization.principal.authorizedDepartmentIds.includes(body.departmentId)) return authorizationError({ allowed: false, status: 403, code: "FORBIDDEN", message: "Finance users can only manage their authorized departments." });

    const allocation = await getRecord<DepartmentBudgetAllocation>("departmentBudgetAllocations", body.departmentAllocationId);
    if (!allocation || allocation.organizationBudgetId !== budget.id || allocation.departmentId !== body.departmentId) return badRequest("Invalid department budget allocation.");

    const childBudgets = await listRecords<ExpenseTypeBudget>("expenseTypeBudgets");
    const existing = childBudgets.find((item) => item.departmentAllocationId === allocation.id && item.expenseType === body.expenseType);
    const allocatedElsewhere = childBudgets
      .filter((item) => item.departmentAllocationId === allocation.id && item.id !== existing?.id)
      .reduce((sum, item) => sum + item.amount, 0);
    if (allocatedElsewhere + body.amount > allocation.amount) return budgetExceeded("Expense-type budgets cannot exceed the department allocation.");

    const now = new Date().toISOString();
    const expenseTypeBudget: ExpenseTypeBudget = {
      id: existing?.id ?? crypto.randomUUID(),
      organizationId: budget.organizationId,
      organizationBudgetId: budget.id,
      departmentAllocationId: allocation.id,
      departmentId: body.departmentId,
      expenseType: body.expenseType,
      amount: body.amount,
      currency: budget.currency,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await runAuditedTransaction(["expenseTypeBudgets"], {
      organizationId: budget.organizationId,
      actorId: authorization.principal.userId,
      action: "EXPENSE_TYPE_BUDGET_UPDATED",
      entityType: "BUDGET",
      entityId: expenseTypeBudget.id,
      metadata: { organizationBudgetId: budget.id, departmentId: body.departmentId, expenseType: body.expenseType, amount: body.amount },
      description: `Updated ${body.expenseType} budget allocation for the authorized department.`,
    }, (transaction) => transaction.objectStore("expenseTypeBudgets").put(expenseTypeBudget));

    return HttpResponse.json(await buildBudgetView(budget, authorization.principal.authorizedDepartmentIds));
  }),
];

async function resolveDepartmentFromBody(request: Request): Promise<string | undefined> {
  const body = (await request.clone().json().catch(() => ({}))) as { departmentId?: unknown };
  return typeof body.departmentId === "string" ? body.departmentId : undefined;
}

async function transitionBudget(
  budgetId: string,
  request: Request,
  nextStatus: "active" | "closed",
) {
  const budget = await getRecord<OrganizationBudget>("budgets", budgetId);
  if (!budget) return apiError(404, "Budget not found.");

  const authorization = await authorizeRequest(request, {
    permission: "budgets.update",
    scope: "ORGANIZATION",
    resource: { organizationId: budget.organizationId, state: budget.status },
  });
  if (!authorization.allowed) return authorizationError(authorization);
  if (authorization.principal.role !== "admin") return authorizationError({ allowed: false, status: 403, code: "FORBIDDEN", message: "Only administrators can manage organization budget lifecycle." });
  if (!isLifecycleTransitionAllowed(budget.status, nextStatus)) return conflict(`Invalid budget lifecycle transition: ${budget.status} to ${nextStatus}.`);

  const updated: OrganizationBudget = { ...budget, status: nextStatus, updatedAt: new Date().toISOString() };
  await runAuditedTransaction(["budgets"], {
    organizationId: budget.organizationId,
    actorId: authorization.principal.userId,
    action: nextStatus === "active" ? "BUDGET_ACTIVATED" : "BUDGET_CLOSED",
    entityType: "BUDGET",
    entityId: budget.id,
    previousState: budget.status,
    newState: nextStatus,
    description: `${nextStatus === "active" ? "Activated" : "Closed"} organization budget ${budget.name}.`,
  }, (transaction) => transaction.objectStore("budgets").put(updated));

  return HttpResponse.json(await buildBudgetView(updated));
}
