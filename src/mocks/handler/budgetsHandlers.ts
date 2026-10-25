import { apiError, workflowErrorResponse } from "../services/apiError";
import { applyCollectionQuery, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";

import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type { BudgetStatus, OrganizationBudget } from "../../features/budgets/types/budget";
import type { Permission } from "../../features/roles/types/role";
import { authorizeRequest, resolveAuthenticatedPrincipal } from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { getRecord, listRecords } from "../services/mockDataService";
import { buildBudgetView, getExpenseCreationEligibility, isBudgetVisibleTo } from "../services/budgetService";
import {
  createBudget,
  deleteDraftBudget,
  rolloverBudget,
  transitionBudget,
  updateBudget,
  type BudgetDetailsRequest,
  type BudgetTransition,
  type RolloverRequest,
} from "../services/budgetLifecycleService";
import {
  allocateToDepartment,
  allocateToTeam,
  setExpenseTypeBudget,
  type DepartmentAllocationRequest,
  type ExpenseTypeBudgetRequest,
  type TeamAllocationRequest,
} from "../services/budgetAllocationService";

async function readBody<T>(request: Request): Promise<T> {
  return (await request.json().catch(() => ({}))) as T;
}

async function authorizeBudgetRead(request: Request, budget: OrganizationBudget) {
  const authorization = await authorizeRequest(request, {
    permission: "budgets.read",
    scope: "ORGANIZATION",
    resource: { organizationId: budget.organizationId },
  });
  if (!authorization.allowed) return { error: authorizationError(authorization) } as const;
  if (!(await isBudgetVisibleTo(authorization.principal, budget))) {
    return { error: apiError(403, "This budget has no allocation within your scope.", "FORBIDDEN") } as const;
  }
  return { principal: authorization.principal } as const;
}

/**
 * Loads the budget, checks the permission within its organization and runs
 * the change. The budget services own the rules and refuse with typed errors.
 */
async function changeBudget(
  request: Request,
  budgetId: string,
  permission: Permission,
  change: (principal: AuthenticatedPrincipal, budget: OrganizationBudget) => Promise<Response>,
): Promise<Response> {
  const budget = await getRecord<OrganizationBudget>("budgets", budgetId);
  if (!budget) return apiError(404, "Budget not found.");
  const authorization = await authorizeRequest(request, {
    permission,
    scope: "ORGANIZATION",
    resource: { organizationId: budget.organizationId },
  });
  if (!authorization.allowed) return authorizationError(authorization);
  try {
    return await change(authorization.principal, budget);
  } catch (error) {
    return workflowErrorResponse(error);
  }
}

/** The budget as the principal sees it, after a change. */
async function budgetResponse(budget: OrganizationBudget, principal: AuthenticatedPrincipal, status = 200) {
  return HttpResponse.json(await buildBudgetView(budget, principal), { status });
}

function transition(budgetId: string, request: Request, budgetTransition: BudgetTransition) {
  return changeBudget(request, budgetId, "budgets.update", async (principal, budget) =>
    budgetResponse(await transitionBudget(principal, budget, budgetTransition), principal));
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
    const { principal } = authorization;
    try {
      return budgetResponse(await createBudget(principal, await readBody<BudgetDetailsRequest>(request)), principal, 201);
    } catch (error) {
      return workflowErrorResponse(error);
    }
  }),

  http.put("/api/budgets/:id", ({ params, request }) =>
    changeBudget(request, String(params.id), "budgets.update", async (principal, budget) =>
      budgetResponse(await updateBudget(principal, budget, await readBody<BudgetDetailsRequest>(request)), principal))),

  http.post("/api/budgets/:id/activate", ({ params, request }) => transition(String(params.id), request, "activate")),

  http.post("/api/budgets/:id/close", ({ params, request }) => transition(String(params.id), request, "close")),

  http.post("/api/budgets/:id/reopen", ({ params, request }) => transition(String(params.id), request, "reopen")),

  http.post("/api/budgets/:id/rollover", ({ params, request }) =>
    changeBudget(request, String(params.id), "budgets.create", async (principal, source) =>
      budgetResponse(await rolloverBudget(principal, source, await readBody<RolloverRequest>(request)), principal, 201))),

  http.delete("/api/budgets/:id", ({ params, request }) =>
    changeBudget(request, String(params.id), "budgets.delete", async (principal, budget) => {
      await deleteDraftBudget(principal, budget);
      return new HttpResponse(null, { status: 204 });
    })),

  http.post("/api/budgets/:id/departments", ({ params, request }) =>
    changeBudget(request, String(params.id), "budgets.update", async (principal, budget) => {
      await allocateToDepartment(principal, budget, await readBody<DepartmentAllocationRequest>(request));
      return budgetResponse(budget, principal);
    })),

  http.post("/api/budgets/:id/teams", ({ params, request }) =>
    changeBudget(request, String(params.id), "budgets.update", async (principal, budget) => {
      await allocateToTeam(principal, budget, await readBody<TeamAllocationRequest>(request));
      return budgetResponse(budget, principal);
    })),

  http.post("/api/budgets/:id/expense-types", ({ params, request }) =>
    changeBudget(request, String(params.id), "budgets.update", async (principal, budget) => {
      await setExpenseTypeBudget(principal, budget, await readBody<ExpenseTypeBudgetRequest>(request));
      return budgetResponse(budget, principal);
    })),
];
