import { http } from "msw";

import { parseCollectionQuery } from "../../services/api/queryParams";
import { authorizeRequest } from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { apiError } from "../services/apiError";
import { getAuthorizedExpenseRecords } from "../services/authorizedExpenseRecords";
import {
  buildDashboardSummary,
  validateDashboardDateRange,
  type DashboardDateRange,
} from "../services/dashboardService";

export const dashboardHandlers = [
  http.get("/api/dashboard/summary", async ({ request }) => {
    const principalAuthorization = await authorizeRequest(request, {
      permission: "expenses.read",
      scope: "ORGANIZATION",
    });

    if (principalAuthorization.allowed === false) {
      return authorizationError(principalAuthorization);
    }

    // The dashboard is the user's personal operational surface: it always
    // aggregates only the authenticated user's own expenses. Wider scopes are
    // served by the Expenses (team/department/organization) and Analytics views.
    const records = await getAuthorizedExpenseRecords(principalAuthorization.principal, "OWN");

    const query = parseCollectionQuery(request);
    const range: DashboardDateRange = {
      from: query.from,
      to: query.to,
    };

    const validationError = validateDashboardDateRange(range);
    if (validationError) {
      return apiError(400, validationError);
    }

    const summary = buildDashboardSummary(
      records,
      range,
      "OWN",
    );

    return Response.json(summary);
  }),
];
