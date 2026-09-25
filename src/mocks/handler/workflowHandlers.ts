import { apiError } from "../services/apiError";
import { applyCollectionQuery, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";

import type { Expense } from "../../features/expenses/types/expense";
import {
  resolveAuthenticatedPrincipal,
  authorizeRequest,
  isExpenseVisibleToPrincipal,
} from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import {
  getApprovalQueue,
  startExpenseReview,
  approveExpense,
  rejectExpense,
} from "../services/approvalService";
import {
  getReimbursementQueue,
  startReimbursement,
  reimburseExpense,
  cancelFinancialExpense,
} from "../services/reimbursementService";
import { getRecord } from "../services/mockDataService";
import { withEmployeeNames } from "../services/authorizedExpenseRecords";
import { runAuditedTransaction } from "../services/auditService";

async function getExpense(id: string) {
  return getRecord<Expense>("expenses", id);
}

function workflowError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "The workflow operation failed.";

  if (message.includes("rejection reason")) {
    return apiError(422, message, "VALIDATION_ERROR", {
      fieldErrors: { reason: message },
    });
  }

  if (message.includes("Invalid expense transition")) {
    return apiError(409, message, "INVALID_STATE_TRANSITION");
  }

  return apiError(403, message, "FORBIDDEN");
}

function expenseNotFound() {
  return apiError(404, "Expense not found.");
}

export const workflowHandlers = [
  http.get("/api/approvals", async ({ request }) => {
    const authorization = await authorizeRequest(request, {
      permission: "expenses.approve",
      scope: "ORGANIZATION",
    });

    if (authorization.allowed === false) {
      return authorizationError(authorization);
    }

    if (authorization.principal.role !== "manager" && authorization.principal.role !== "admin") {
      return apiError(403, "Only authorized team managers and administrators have an approval queue.");
    }

    return HttpResponse.json(
      await withEmployeeNames(
        applyCollectionQuery(await getApprovalQueue(authorization.principal), parseCollectionQuery(request)),
      ),
    );
  }),

  http.post("/api/expenses/:id/review", async ({ params, request }) => {
    const expense = await getExpense(String(params.id));

    if (!expense) {
      return expenseNotFound();
    }

    const authorization = await authorizeRequest(request, {
      permission: "expenses.approve",
      scope: "ORGANIZATION",
    });

    if (authorization.allowed === false) {
      return authorizationError(authorization);
    }

    if (!isExpenseVisibleToPrincipal(authorization.principal, expense)) {
      return expenseNotFound();
    }

    try {
      return HttpResponse.json(
        await startExpenseReview(authorization.principal, expense),
      );
    } catch (error) {
      return workflowError(error);
    }
  }),

  http.post("/api/expenses/:id/approve", async ({ params, request }) => {
    const expense = await getExpense(String(params.id));

    if (!expense) {
      return expenseNotFound();
    }

    const authorization = await authorizeRequest(request, {
      permission: "expenses.approve",
      scope: "ORGANIZATION",
    });

    if (authorization.allowed === false) {
      return authorizationError(authorization);
    }

    if (!isExpenseVisibleToPrincipal(authorization.principal, expense)) {
      return expenseNotFound();
    }

    try {
      return HttpResponse.json(
        await approveExpense(authorization.principal, expense),
      );
    } catch (error) {
      return workflowError(error);
    }
  }),

  http.post("/api/expenses/:id/reject", async ({ params, request }) => {
    const expense = await getExpense(String(params.id));

    if (!expense) {
      return expenseNotFound();
    }

    const authorization = await authorizeRequest(request, {
      permission: "expenses.reject",
      scope: "ORGANIZATION",
    });

    if (authorization.allowed === false) {
      return authorizationError(authorization);
    }

    if (!isExpenseVisibleToPrincipal(authorization.principal, expense)) {
      return expenseNotFound();
    }

    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };

    try {
      return HttpResponse.json(
        await rejectExpense(
          authorization.principal,
          expense,
          typeof body.reason === "string" ? body.reason : "",
        ),
      );
    } catch (error) {
      return workflowError(error);
    }
  }),

  http.get("/api/reimbursements", async ({ request }) => {
    const authorization = await authorizeRequest(request, {
      permission: "reimbursements.manage",
      scope: "DEPARTMENT",
    });

    if (authorization.allowed === false) {
      return authorizationError(authorization);
    }

    if (authorization.principal.role !== "finance") {
      return apiError(403, "Only authorized Finance users have a reimbursement queue.");
    }

    return HttpResponse.json(
      await withEmployeeNames(
        applyCollectionQuery(await getReimbursementQueue(authorization.principal), parseCollectionQuery(request)),
      ),
    );
  }),

  http.post(
    "/api/expenses/:id/start-reimbursement",
    async ({ params, request }) => {
      const expense = await getExpense(String(params.id));

      if (!expense) {
        return expenseNotFound();
      }

      const authorization = await authorizeRequest(request, {
        permission: "reimbursements.manage",
        scope: "DEPARTMENT",
      });

      if (authorization.allowed === false) {
        return authorizationError(authorization);
      }

      if (!isExpenseVisibleToPrincipal(authorization.principal, expense)) {
        return expenseNotFound();
      }

      try {
        return HttpResponse.json(
          await startReimbursement(authorization.principal, expense),
        );
      } catch (error) {
        return workflowError(error);
      }
    },
  ),

  http.post("/api/expenses/:id/reimburse", async ({ params, request }) => {
    const expense = await getExpense(String(params.id));

    if (!expense) {
      return expenseNotFound();
    }

    const authorization = await authorizeRequest(request, {
      permission: "reimbursements.manage",
      scope: "DEPARTMENT",
    });

    if (authorization.allowed === false) {
      return authorizationError(authorization);
    }

    if (!isExpenseVisibleToPrincipal(authorization.principal, expense)) {
      return expenseNotFound();
    }

    try {
      return HttpResponse.json(
        await reimburseExpense(authorization.principal, expense),
      );
    } catch (error) {
      return workflowError(error);
    }
  }),

  http.post("/api/expenses/:id/cancel", async ({ params, request }) => {
    const expense = await getExpense(String(params.id));

    if (!expense) {
      return expenseNotFound();
    }

    const principal = await resolveAuthenticatedPrincipal(request);

    if (!principal) {
      return apiError(401, "Authentication required.");
    }

    if (!isExpenseVisibleToPrincipal(principal, expense)) {
      return expenseNotFound();
    }

    if (expense.status === "draft") {
      // Drafts are owner-private; only the owner may cancel one (§35.1).
      const authorization = await authorizeRequest(request, {
        permission: "expenses.update",
        scope: "OWN",
        resource: {
          organizationId: expense.organizationId,
          ownerId: expense.employeeId,
          teamId: expense.teamId,
          departmentId: expense.departmentId,
          state: expense.status,
        },
        allowedStates: ["draft"],
      });

      if (authorization.allowed === false) {
        return authorizationError(authorization);
      }

      const updatedExpense = {
        ...expense,
        status: "cancelled" as const,
        cancelledAt: new Date().toISOString(),
        cancelledBy: principal.userId,
        updatedAt: new Date().toISOString(),
      };

      await runAuditedTransaction(
        ["expenses"],
        {
          organizationId: updatedExpense.organizationId,
          actorId: principal.userId,
          action: "EXPENSE_CANCELLED",
          entityType: "EXPENSE",
          entityId: updatedExpense.id,
          previousState: expense.status,
          newState: updatedExpense.status,
          description: `Cancelled expense ${updatedExpense.title}.`,
        },
        (transaction) => {
          transaction.objectStore("expenses").put(updatedExpense);
        },
      );

      return HttpResponse.json(updatedExpense);
    }

    try {
      return HttpResponse.json(
        await cancelFinancialExpense(principal, expense),
      );
    } catch (error) {
      return workflowError(error);
    }
  }),
];
