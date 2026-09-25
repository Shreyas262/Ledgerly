import { apiError } from "../services/apiError";
import { applyCollectionQueryResult, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";
import type { ExpenseType } from "../../features/expenses/types/expense";
import type { PolicyEvaluation } from "../../features/policies/types/policy";

import type { ExpenseStatus } from "../../features/expenses/types/expense";
import { transitionExpenseState } from "../../features/expenses/domain/expenseStateMachine";
import {
  authorizeRequest,
  isExpenseVisibleToPrincipal,
  resolveExpenseScope,
  type AuthorizationScope,
} from "../services/authorizationService";
import {
  getAuthorizedExpenseRecords,
  isExpenseScopeAllowed,
  withEmployeeNames,
} from "../services/authorizedExpenseRecords";
import { authorizationError } from "../services/authorizationHttp";
import { runAuditedTransaction } from "../services/auditService";
import {
  evaluateExpensePolicy,
  isSubmissionAllowed,
  persistExpenseSubmissionEvaluation,
} from "../services/policyService";
import { getRecord } from "../services/mockDataService";

interface MockExpense {
  id: string;
  organizationId: string;
  departmentId: string;
  teamId: string;
  employeeId: string;
  type?: ExpenseType;
  title: string;
  description: string;
  amount: number;
  currency: "INR";
  status: string;
  expenseDate: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
  policyId?: string;
  policyEvaluation?: PolicyEvaluation;
  submittedAt?: string;
  documentIds?: string[];
  [key: string]: unknown;
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

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateExpenseBody(body: unknown): {
  type: ExpenseType;
  title: string;
  description: string;
  amount: number;
  currency: "INR";
  expenseDate: string;
} | { fieldErrors: Record<string, string> } {
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const fieldErrors: Record<string, string> = {};

  const type = value.type;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const amount = typeof value.amount === "number" ? value.amount : Number(value.amount);
  const currency = value.currency;
  const expenseDate = typeof value.expenseDate === "string" ? value.expenseDate : "";

  if (typeof type !== "string" || !EXPENSE_TYPES.has(type as ExpenseType)) fieldErrors.type = "A valid expense type is required.";
  if (!title) fieldErrors.title = "Title is required.";
  if (!description) fieldErrors.description = "Description is required.";
  if (!Number.isFinite(amount) || amount <= 0) fieldErrors.amount = "Amount must be greater than zero.";
  if (currency !== "INR") fieldErrors.currency = "Only INR is supported.";
  if (!isValidDateOnly(expenseDate)) {
    fieldErrors.expenseDate = "A valid expense date is required.";
  }

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  return {
    type: type as ExpenseType,
    title,
    description,
    amount,
    currency: "INR",
    expenseDate,
  };
}

function getExpenseResource(expense: MockExpense) {
  return {
    organizationId: expense.organizationId,
    ownerId: expense.employeeId,
    teamId: expense.teamId,
    departmentId: expense.departmentId,
    state: expense.status,
  };
}

const EXPENSE_SCOPES = new Set<AuthorizationScope>([
  "OWN",
  "TEAM",
  "DEPARTMENT",
  "ORGANIZATION",
]);

function expenseNotFound() {
  return apiError(404, "Expense not found.");
}

/**
 * Authorizes an owner-only lifecycle operation (§13, §35.2). A draft that is
 * not visible to the principal is concealed as not found.
 */
async function authorizeOwnerOperation(
  request: Request,
  expense: MockExpense,
  permission: "expenses.update" | "expenses.submit",
  allowedStates: readonly ExpenseStatus[],
) {
  const principalAuthorization = await authorizeRequest(request, {
    permission,
    scope: "ORGANIZATION",
  });

  if (principalAuthorization.allowed === false) {
    return { error: authorizationError(principalAuthorization) } as const;
  }

  if (!isExpenseVisibleToPrincipal(principalAuthorization.principal, expense)) {
    return { error: expenseNotFound() } as const;
  }

  const authorization = await authorizeRequest(request, {
    permission,
    scope: "OWN",
    resource: getExpenseResource(expense),
    allowedStates,
  });

  if (authorization.allowed === false) {
    return { error: authorizationError(authorization) } as const;
  }

  return { principal: authorization.principal } as const;
}

export const expensesHandlers = [
  http.get("/api/expenses", async ({ request }) => {
    const principalAuthorization = await authorizeRequest(request, {
      permission: "expenses.read",
      scope: "ORGANIZATION",
    });

    if (principalAuthorization.allowed === false) {
      return authorizationError(principalAuthorization);
    }

    const { principal } = principalAuthorization;
    const requestedScope = new URL(request.url).searchParams.get("scope");
    const scope = (requestedScope ?? resolveExpenseScope(principal)) as AuthorizationScope;

    if (!EXPENSE_SCOPES.has(scope)) {
      return apiError(422, "Invalid expense scope.", "INVALID_FILTER");
    }

    // Filters may narrow the authorized scope but never expand it (§20.5).
    if (!isExpenseScopeAllowed(principal, scope)) {
      return apiError(403, "You are not authorized to view expenses in this scope.");
    }

    const records = await getAuthorizedExpenseRecords(principal, scope);
    const result = applyCollectionQueryResult(records, parseCollectionQuery(request));

    return HttpResponse.json({ ...result, data: await withEmployeeNames(result.data) });
  }),

  http.get("/api/expenses/:id", async ({ params, request }) => {
    const expense = await getRecord<MockExpense>(
      "expenses",
      String(params.id),
    );

    if (!expense) {
      return expenseNotFound();
    }

    const principalAuthorization = await authorizeRequest(request, {
      permission: "expenses.read",
      scope: "ORGANIZATION",
    });

    if (principalAuthorization.allowed === false) {
      return authorizationError(principalAuthorization);
    }

    if (!isExpenseVisibleToPrincipal(principalAuthorization.principal, expense)) {
      return expenseNotFound();
    }

    const authorization = await authorizeRequest(request, {
      permission: "expenses.read",
      scope: resolveExpenseScope(principalAuthorization.principal),
      resource: getExpenseResource(expense),
    });

    if (authorization.allowed === false) {
      return authorizationError(authorization);
    }

    const [namedExpense] = await withEmployeeNames([expense]);
    return HttpResponse.json(namedExpense);
  }),

  http.post("/api/expenses", async ({ request }) => {
    const authorization = await authorizeRequest(request, {
      permission: "expenses.create",
      scope: "ORGANIZATION",
    });

    if (authorization.allowed === false) {
      return authorizationError(authorization);
    }

    const body = validateExpenseBody(await request.json());
    if ("fieldErrors" in body) {
      return apiError(422, "Expense validation failed.", "VALIDATION_ERROR", { fieldErrors: body.fieldErrors });
    }

    const now = new Date().toISOString();

    const newExpense: MockExpense = {
      id: crypto.randomUUID(),
      organizationId: authorization.principal.organizationId,
      departmentId: authorization.principal.departmentId,
      teamId: authorization.principal.teamId,
      employeeId: authorization.principal.userId,
      type: body.type,
      title: body.title,
      description: body.description,
      amount: body.amount,
      currency: body.currency,
      expenseDate: body.expenseDate,
      status: "draft",
      documentIds: [],
      createdAt: now,
      updatedAt: now,
    };

    // §21.7: creation participates in policy evaluation; submission remains
    // the authoritative enforcement point.
    const evaluation = await evaluateExpensePolicy(newExpense);
    newExpense.policyId = evaluation.policyId;
    newExpense.policyEvaluation = evaluation;

    await runAuditedTransaction(
      ["expenses"],
      {
        organizationId: newExpense.organizationId,
        actorId: authorization.principal.userId,
        action: "EXPENSE_CREATED",
        entityType: "EXPENSE",
        entityId: newExpense.id,
        newState: newExpense.status,
        metadata: { amount: newExpense.amount, currency: newExpense.currency },
        description: `Created expense ${newExpense.title}.`,
      },
      (transaction) => {
        transaction.objectStore("expenses").put(newExpense);
      },
    );

    return HttpResponse.json(newExpense, { status: 201 });
  }),

  http.put("/api/expenses/:id", async ({ params, request }) => {
    const expenseId = String(params.id);
    const existingExpense = await getRecord<MockExpense>(
      "expenses",
      expenseId,
    );

    if (!existingExpense) {
      return expenseNotFound();
    }

    const authorization = await authorizeOwnerOperation(
      request,
      existingExpense,
      "expenses.update",
      ["draft"],
    );

    if ("error" in authorization) {
      return authorization.error;
    }

    const body = validateExpenseBody(await request.json());
    if ("fieldErrors" in body) {
      return apiError(422, "Expense validation failed.", "VALIDATION_ERROR", { fieldErrors: body.fieldErrors });
    }

    const updatedExpense: MockExpense = {
      ...existingExpense,
      ...body,
      organizationId: existingExpense.organizationId,
      departmentId: existingExpense.departmentId,
      teamId: existingExpense.teamId,
      employeeId: existingExpense.employeeId,
      currency: body.currency,
      updatedAt: new Date().toISOString(),
    };

    // §21.7: updates participate in policy evaluation.
    const evaluation = await evaluateExpensePolicy(updatedExpense);
    updatedExpense.policyId = evaluation.policyId;
    updatedExpense.policyEvaluation = evaluation;

    await runAuditedTransaction(
      ["expenses"],
      {
        organizationId: updatedExpense.organizationId,
        actorId: authorization.principal.userId,
        action: "EXPENSE_UPDATED",
        entityType: "EXPENSE",
        entityId: updatedExpense.id,
        previousState: existingExpense.status,
        newState: updatedExpense.status,
        metadata: {
          amount: updatedExpense.amount,
          currency: updatedExpense.currency,
          changes: (["type", "title", "description", "amount", "expenseDate"] as const)
            .filter((field) => existingExpense[field] !== updatedExpense[field])
            .map((field) => ({
              field,
              previousValue: existingExpense[field],
              newValue: updatedExpense[field],
            })),
        },
        description: `Updated expense ${updatedExpense.title}.`,
      },
      (transaction) => {
        transaction.objectStore("expenses").put(updatedExpense);
      },
    );

    return HttpResponse.json(updatedExpense);
  }),

  http.post("/api/expenses/:id/submit", async ({ params, request }) => {
    const expense = await getRecord<MockExpense>(
      "expenses",
      String(params.id),
    );

    if (!expense) {
      return expenseNotFound();
    }

    const authorization = await authorizeOwnerOperation(
      request,
      expense,
      "expenses.submit",
      ["draft"],
    );

    if ("error" in authorization) {
      return authorization.error;
    }

    const evaluation = await evaluateExpensePolicy(expense);
    const submissionAllowed = isSubmissionAllowed(evaluation);

    await persistExpenseSubmissionEvaluation(
      expense,
      evaluation,
      submissionAllowed,
      {
        organizationId: expense.organizationId,
        actorId: authorization.principal.userId,
        action: submissionAllowed ? "EXPENSE_SUBMITTED" : "EXPENSE_SUBMISSION_REJECTED",
        entityType: "EXPENSE",
        entityId: expense.id,
        previousState: expense.status,
        newState: submissionAllowed ? "submitted" : expense.status,
        metadata: { policyId: evaluation.policyId, evaluationResult: evaluation.result },
        description: submissionAllowed
          ? `Submitted expense ${expense.title} for review.`
          : `Submission of expense ${expense.title} was blocked by policy.`,
      },
    );

    const evaluatedExpense = {
      ...expense,
      status: submissionAllowed ? "submitted" : expense.status,
      policyId: evaluation.policyId,
      policyEvaluation: evaluation,
      ...(submissionAllowed ? { submittedAt: evaluation.evaluatedAt } : {}),
      updatedAt: evaluation.evaluatedAt,
    };

    if (!submissionAllowed) {
      return apiError(
        422,
        evaluation.result === "MISSING_INFORMATION"
          ? "Expense is missing information required by the applicable policy."
          : "Expense violates the applicable policy.",
        "POLICY_VIOLATION",
        { evaluation, expense: evaluatedExpense },
      );
    }

    return HttpResponse.json(evaluatedExpense);
  }),

  http.post("/api/expenses/:id/restore", async ({ params, request }) => {
    const expense = await getRecord<MockExpense>(
      "expenses",
      String(params.id),
    );

    if (!expense) {
      return expenseNotFound();
    }

    const authorization = await authorizeOwnerOperation(
      request,
      expense,
      "expenses.update",
      ["rejected"],
    );

    if ("error" in authorization) {
      return authorization.error;
    }

    const now = new Date().toISOString();
    const restoredExpense: MockExpense = {
      ...expense,
      status: transitionExpenseState("RESTORE", expense.status as ExpenseStatus),
      updatedAt: now,
    };

    await runAuditedTransaction(
      ["expenses"],
      {
        organizationId: restoredExpense.organizationId,
        actorId: authorization.principal.userId,
        action: "EXPENSE_RESTORED",
        entityType: "EXPENSE",
        entityId: restoredExpense.id,
        previousState: expense.status,
        newState: restoredExpense.status,
        metadata: { rejectionReason: expense.rejectionReason },
        description: `Returned rejected expense ${restoredExpense.title} to draft.`,
      },
      (transaction) => {
        transaction.objectStore("expenses").put(restoredExpense);
      },
    );

    return HttpResponse.json(restoredExpense);
  }),
];
