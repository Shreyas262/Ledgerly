import { http } from "msw";
import type { AnalyticsQuery, AnalyticsScope } from "../../features/analytics/types/analytics";
import type { ExpenseType } from "../../features/expenses/types/expense";
import { listRecords } from "../services/mockDataService";
import { authorizeRequest, resolveExpenseScope } from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { apiError } from "../services/apiError";
import { getAuthorizedExpenseRecords } from "../services/authorizedExpenseRecords";
import { buildAnalyticsSummary, validateAnalyticsQuery } from "../services/analyticsService";

function resolveAnalyticsScope(role: string): AnalyticsScope {
  switch (role) {
    case "admin": return "ORGANIZATION";
    case "finance": return "DEPARTMENT";
    default: return "TEAM";
  }
}

export const analyticsHandlers = [
  http.get("/api/analytics/summary", async ({ request }) => {
    const permissionAuthorization = await authorizeRequest(request, {
      permission: "analytics.read",
      scope: "ORGANIZATION",
    });
    if (permissionAuthorization.allowed === false) return authorizationError(permissionAuthorization);

    const scope = resolveExpenseScope(permissionAuthorization.principal);
    const records = await getAuthorizedExpenseRecords(permissionAuthorization.principal);

    const url = new URL(request.url);
    const query: AnalyticsQuery = {
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      type: (url.searchParams.get("type") || undefined) as ExpenseType | undefined,
      status: url.searchParams.get("status") || undefined,
      departmentId: url.searchParams.get("departmentId") || undefined,
      teamId: url.searchParams.get("teamId") || undefined,
    };

    if (query.departmentId && scope !== "ORGANIZATION" && !permissionAuthorization.principal.authorizedDepartmentIds.includes(query.departmentId)) {
      return apiError(400, "The department filter cannot expand the authorized analytics scope.", "INVALID_FILTER");
    }
    if (query.teamId && scope === "TEAM" && query.teamId !== permissionAuthorization.principal.teamId) {
      return apiError(400, "The team filter cannot expand the authorized analytics scope.", "INVALID_FILTER");
    }

    const validationError = validateAnalyticsQuery(query);
    if (validationError) return apiError(400, validationError, "INVALID_DATE_RANGE");

    const organizationId = permissionAuthorization.principal.organizationId;
    const [departments, teams] = await Promise.all([
      listRecords<{ id: string; organizationId: string; name: string }>("departments"),
      listRecords<{ id: string; organizationId: string; name: string }>("teams"),
    ]);
    const namesOf = (items: Array<{ id: string; organizationId: string; name: string }>) =>
      new Map(items.filter((item) => item.organizationId === organizationId).map((item) => [item.id, item.name]));

    return Response.json(buildAnalyticsSummary(
      records,
      query,
      resolveAnalyticsScope(permissionAuthorization.principal.role),
      { departments: namesOf(departments), teams: namesOf(teams) },
    ));
  }),
];
