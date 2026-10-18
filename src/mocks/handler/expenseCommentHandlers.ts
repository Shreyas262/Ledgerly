import { http, HttpResponse } from "msw";

import type { Expense } from "../../features/expenses/types/expense";
import type { ExpenseCommentThread } from "../../features/expenses/types/comment";
import { apiError } from "../services/apiError";
import { authorizationError } from "../services/authorizationHttp";
import { authorizeRequest, isExpenseVisibleToPrincipal, resolveExpenseReadScope } from "../services/authorizationService";
import { addExpenseComment, getCommentClosedReason, listExpenseComments } from "../services/expenseCommentService";
import { getRecord } from "../services/mockDataService";

/**
 * Comments follow the expense's read access (§29.10): whoever may open the
 * expense may read and join its discussion. The checks match
 * `GET /api/expenses/:id`, including draft privacy.
 */
async function authorizeExpenseReader(request: Request, expenseId: string) {
  const expense = await getRecord<Expense>("expenses", expenseId);
  if (!expense) return { error: apiError(404, "Expense not found.") } as const;

  const principalAuthorization = await authorizeRequest(request, { permission: "expenses.read", scope: "ORGANIZATION" });
  if (!principalAuthorization.allowed) return { error: authorizationError(principalAuthorization) } as const;

  if (!isExpenseVisibleToPrincipal(principalAuthorization.principal, expense)) {
    return { error: apiError(404, "Expense not found.") } as const;
  }

  const authorization = await authorizeRequest(request, {
    permission: "expenses.read",
    scope: resolveExpenseReadScope(principalAuthorization.principal, expense),
    resource: {
      organizationId: expense.organizationId,
      ownerId: expense.employeeId,
      teamId: expense.teamId,
      departmentId: expense.departmentId,
      state: expense.status,
    },
  });
  if (!authorization.allowed) return { error: authorizationError(authorization) } as const;

  return { expense, principal: authorization.principal } as const;
}

export const expenseCommentHandlers = [
  http.get("/api/expenses/:id/comments", async ({ params, request }) => {
    const authorized = await authorizeExpenseReader(request, String(params.id));
    if ("error" in authorized) return authorized.error;

    const closedReason = getCommentClosedReason(authorized.expense.status);
    const thread: ExpenseCommentThread = {
      comments: await listExpenseComments(authorized.expense.id),
      canComment: !closedReason,
      ...(closedReason ? { closedReason } : {}),
    };
    return HttpResponse.json(thread);
  }),

  http.post("/api/expenses/:id/comments", async ({ params, request }) => {
    const authorized = await authorizeExpenseReader(request, String(params.id));
    if ("error" in authorized) return authorized.error;

    const payload = (await request.json().catch(() => null)) as { body?: unknown } | null;
    const result = await addExpenseComment(authorized.principal, authorized.expense, payload?.body);
    if (!result.ok) {
      return apiError(result.status, result.message, undefined, result.fieldErrors ? { fieldErrors: result.fieldErrors } : undefined);
    }
    return HttpResponse.json(result.comment, { status: 201 });
  }),
];
