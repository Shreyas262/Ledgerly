import { http } from "msw";
import type {
  AnalyticsBudgetComparison,
  AnalyticsFilterOptions,
  AnalyticsQuery,
  AnalyticsScope,
} from "../../features/analytics/types/analytics";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import { EXPENSE_TYPE_LABELS, type ExpenseType } from "../../features/expenses/types/expense";
import { listRecords, listRecordsByIndex } from "../services/mockDataService";
import type { Expense } from "../../features/expenses/types/expense";
import { authorizeRequest } from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { apiError } from "../services/apiError";
import { getAuthorizedExpenseRecords } from "../services/authorizedExpenseRecords";
import { buildAnalyticsSummary, validateAnalyticsQuery, type AnalyticsPolicySnapshot } from "../services/analyticsService";
import { buildBudgetView, findActiveBudgetForDate, todayDate } from "../services/budgetService";

interface StructureRecord {
  id: string;
  organizationId: string;
  name: string;
  status?: string;
  departmentId?: string;
}

function resolveAnalyticsScope(role: string): AnalyticsScope {
  switch (role) {
    case "admin": return "ORGANIZATION";
    case "finance": return "DEPARTMENT";
    default: return "TEAM";
  }
}

/** Departments and teams the principal may filter by (§26.3). */
function buildFilterOptions(
  scope: AnalyticsScope,
  principal: AuthenticatedPrincipal,
  departments: StructureRecord[],
  teams: StructureRecord[],
): AnalyticsFilterOptions {
  if (scope === "TEAM") return { departments: [], teams: [] };
  const allowedDepartments = departments.filter((department) =>
    department.status !== "inactive" &&
    (scope === "ORGANIZATION" || principal.authorizedDepartmentIds.includes(department.id)));
  const allowedIds = new Set(allowedDepartments.map((department) => department.id));
  const byName = (first: { name: string }, second: { name: string }) => first.name.localeCompare(second.name);
  return {
    departments: allowedDepartments.map(({ id, name }) => ({ id, name })).sort(byName),
    teams: teams
      .filter((team) => team.status !== "inactive" && team.departmentId && allowedIds.has(team.departmentId))
      .map(({ id, name, departmentId }) => ({ id, name, departmentId: departmentId! }))
      .sort(byName),
  };
}

/**
 * Allocation against reimbursed spend in the active budget, one level below
 * the current view: departments (admin), teams (finance or a department
 * filter), expense types (manager or a team filter).
 */
async function buildBudgetComparison(
  scope: AnalyticsScope,
  principal: AuthenticatedPrincipal,
  query: AnalyticsQuery,
): Promise<AnalyticsBudgetComparison | null> {
  const budget = await findActiveBudgetForDate(principal.organizationId, todayDate());
  if (!budget) return null;
  const view = await buildBudgetView(budget, principal);
  const base = { budgetName: budget.name, startDate: budget.startDate, endDate: budget.endDate };
  const teamAllocations = view.departmentAllocations.flatMap((allocation) => allocation.teamAllocations);

  const teamId = query.teamId ?? (scope === "TEAM" ? principal.teamId : undefined);
  if (teamId) {
    const team = teamAllocations.find((allocation) => allocation.teamId === teamId);
    return {
      ...base,
      level: "EXPENSE_TYPE",
      // The team total first, then its expense-type budgets.
      rows: team
        ? [
            { id: team.teamId, name: `${team.teamName} total`, allocated: team.amount, spent: team.utilization.spentAmount },
            ...team.expenseTypeBudgets
              .filter((typeBudget) => !query.type || typeBudget.expenseType === query.type)
              .map((typeBudget) => ({
                id: typeBudget.id,
                name: EXPENSE_TYPE_LABELS[typeBudget.expenseType],
                allocated: typeBudget.amount,
                spent: typeBudget.utilization.spentAmount,
              })),
          ]
        : [],
    };
  }
  if (query.departmentId || scope === "DEPARTMENT") {
    return {
      ...base,
      level: "TEAM",
      rows: teamAllocations
        .filter((allocation) => !query.departmentId || allocation.departmentId === query.departmentId)
        .map((allocation) => ({
          id: allocation.teamId,
          name: allocation.teamName,
          allocated: allocation.amount,
          spent: allocation.utilization.spentAmount,
        })),
    };
  }
  return {
    ...base,
    level: "DEPARTMENT",
    rows: view.departmentAllocations.map((allocation) => ({
      id: allocation.departmentId,
      name: allocation.departmentName,
      allocated: allocation.amount,
      spent: allocation.utilization.spentAmount,
    })),
  };
}

export const analyticsHandlers = [
  http.get("/api/analytics/summary", async ({ request }) => {
    const permissionAuthorization = await authorizeRequest(request, {
      permission: "analytics.read",
      scope: "ORGANIZATION",
    });
    if (permissionAuthorization.allowed === false) return authorizationError(permissionAuthorization);
    const { principal } = permissionAuthorization;
    const scope = resolveAnalyticsScope(principal.role);

    const url = new URL(request.url);
    const query: AnalyticsQuery = {
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      type: (url.searchParams.get("type") || undefined) as ExpenseType | undefined,
      departmentId: url.searchParams.get("departmentId") || undefined,
      teamId: url.searchParams.get("teamId") || undefined,
    };
    if (query.type && !(query.type in EXPENSE_TYPE_LABELS)) {
      return apiError(400, "The selected expense type is not valid.", "INVALID_FILTER");
    }

    const validationError = validateAnalyticsQuery(query);
    if (validationError) return apiError(400, validationError, "INVALID_DATE_RANGE");

    const organizationId = principal.organizationId;
    const [allDepartments, allTeams] = await Promise.all([
      listRecords<StructureRecord>("departments"),
      listRecords<StructureRecord>("teams"),
    ]);
    const departments = allDepartments.filter((item) => item.organizationId === organizationId);
    const teams = allTeams.filter((item) => item.organizationId === organizationId);

    // Filters may narrow the authorized scope but never expand it.
    if (scope === "TEAM" && (query.departmentId || (query.teamId && query.teamId !== principal.teamId))) {
      return apiError(400, "Managers can view analytics for their own team only.", "INVALID_FILTER");
    }
    if (query.departmentId && (
      !departments.some((department) => department.id === query.departmentId) ||
      (scope === "DEPARTMENT" && !principal.authorizedDepartmentIds.includes(query.departmentId))
    )) {
      return apiError(400, "You can only view analytics for departments you are authorized for.", "INVALID_FILTER");
    }
    if (query.teamId && scope !== "TEAM") {
      const team = teams.find((item) => item.id === query.teamId);
      if (
        !team ||
        (scope === "DEPARTMENT" && !principal.authorizedDepartmentIds.includes(team.departmentId ?? "")) ||
        (query.departmentId && team.departmentId !== query.departmentId)
      ) {
        return apiError(400, "You can only view analytics for teams within your authorized scope.", "INVALID_FILTER");
      }
    }

    const [records, storedChecks, organizationExpenses] = await Promise.all([
      getAuthorizedExpenseRecords(principal),
      listRecords<Omit<AnalyticsPolicySnapshot, "expense"> & { organizationId: string }>("policyEvaluations"),
      listRecordsByIndex<Expense>("expenses", "organizationId", principal.organizationId),
    ]);
    // Blocked submission attempts belong to drafts, which are private: resolve
    // only the fields needed for aggregate counts, within the viewer's scope.
    const expenseById = new Map(organizationExpenses.map((expense) => [expense.id, expense]));
    const inScope = (expense: Expense) =>
      scope === "ORGANIZATION" ||
      (scope === "DEPARTMENT" && principal.authorizedDepartmentIds.includes(expense.departmentId)) ||
      (scope === "TEAM" && expense.teamId === principal.teamId);
    const policySnapshots: AnalyticsPolicySnapshot[] = storedChecks.flatMap((check) => {
      const expense = expenseById.get(check.expenseId);
      if (check.organizationId !== organizationId || !expense || !inScope(expense)) return [];
      const { amount, type, status, expenseDate, departmentId, teamId } = expense;
      return [{ expenseId: check.expenseId, result: check.result, details: check.details, expense: { amount, type, status, expenseDate, departmentId, teamId } }];
    });
    const namesOf = (items: StructureRecord[]) => new Map(items.map((item) => [item.id, item.name]));

    return Response.json({
      ...buildAnalyticsSummary(
        records,
        query,
        scope,
        { departments: namesOf(departments), teams: namesOf(teams) },
        policySnapshots,
      ),
      filterOptions: buildFilterOptions(scope, principal, departments, teams),
      budgetComparison: await buildBudgetComparison(scope, principal, query),
    });
  }),
];
