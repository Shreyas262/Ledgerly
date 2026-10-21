import { apiError } from "../services/apiError";
import { formatDate } from "../../utils/format";
import { BASE_CURRENCY, formatMoney, isCurrencyCode } from "../../utils/currency";
import type { CurrencyCode } from "../../types/common";
import { applyCollectionQueryResult, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";
import {
  EXPENSE_TYPES,
  MAX_BULK_SUBMIT,
  type BulkSubmitResult,
  type Expense,
  type ExpenseStatus,
  type ExpenseType,
} from "../../features/expenses/types/expense";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import { transitionExpenseState } from "../../features/expenses/domain/expenseStateMachine";
import {
  authorizeRequest,
  isExpenseVisibleToPrincipal,
  resolveExpenseReadScope,
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
import { evaluateExpensePolicy } from "../services/policyService";
import { getRecord } from "../services/mockDataService";
import { findActiveBudgetForDate, getExpenseCreationEligibility, todayDate } from "../services/budgetService";
import { submitDraftExpense } from "../services/submissionService";
import { conversionAuditDetails, toRupees } from "../services/exchangeRateService";
import { describePaidAmount } from "../../features/currency/utils/rateText";

/**
 * Expenses may be created only while an active budget covers today, and must
 * be dated within that budget's period so they count against it.
 */
async function checkBudgetPeriod(
  principal: { organizationId: string; departmentId: string; teamId: string },
  expenseDate: string,
  requireCreationEligibility: boolean,
) {
  let budget;
  if (requireCreationEligibility) {
    const eligibility = await getExpenseCreationEligibility(principal);
    if (!eligibility.allowed) return apiError(422, eligibility.reason!, eligibility.code);
    budget = eligibility.budget!;
  } else {
    budget = await findActiveBudgetForDate(principal.organizationId, todayDate());
    if (!budget) return null;
  }
  if (expenseDate < budget.startDate || expenseDate > budget.endDate) {
    const message = `The expense date must fall within the active budget period (${formatDate(budget.startDate)} to ${formatDate(budget.endDate)}).`;
    return apiError(422, message, "OUTSIDE_BUDGET_PERIOD", { fieldErrors: { expenseDate: message } });
  }
  return null;
}

const EXPENSE_TYPE_VALUES = new Set<string>(EXPENSE_TYPES);

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The amount as paid, e.g. "USD 60.00" or "₹1,200". */
const paidAs = (expense: Expense) =>
  expense.conversion ? describePaidAmount(expense.conversion) : formatMoney(expense.amount);

function validateExpenseBody(body: unknown): {
  type: ExpenseType;
  title: string;
  description: string;
  /** As paid, in `currency`. */
  amount: number;
  currency: CurrencyCode;
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

  if (typeof type !== "string" || !EXPENSE_TYPE_VALUES.has(type)) fieldErrors.type = "A valid expense type is required.";
  if (!title) fieldErrors.title = "Title is required.";
  if (!description) fieldErrors.description = "Description is required.";
  if (!Number.isFinite(amount) || amount <= 0) fieldErrors.amount = "Amount must be greater than zero.";
  if (!isCurrencyCode(currency)) fieldErrors.currency = "Choose a supported currency.";
  if (!isValidDateOnly(expenseDate)) {
    fieldErrors.expenseDate = "A valid expense date is required.";
  }

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  return {
    type: type as ExpenseType,
    title,
    description,
    amount,
    currency: currency as CurrencyCode,
    expenseDate,
  };
}

function getExpenseResource(expense: Expense) {
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
  expense: Expense,
  permission: "expenses.update" | "expenses.submit",
  allowedStates: readonly ExpenseStatus[],
): Promise<{ error: Response } | { principal: AuthenticatedPrincipal }> {
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
      return apiError(422, "The requested expense view is not valid.", "INVALID_FILTER");
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
    const expense = await getRecord<Expense>(
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
      scope: resolveExpenseReadScope(principalAuthorization.principal, expense),
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
      return apiError(422, "Please correct the highlighted fields.", "VALIDATION_ERROR", { fieldErrors: body.fieldErrors });
    }

    const periodError = await checkBudgetPeriod(authorization.principal, body.expenseDate, true);
    if (periodError) return periodError;

    // Expenses are kept in rupees, with the rate of the expense date for other currencies.
    const { amount, conversion } = await toRupees(body.amount, body.currency, body.expenseDate);
    const now = new Date().toISOString();

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      organizationId: authorization.principal.organizationId,
      departmentId: authorization.principal.departmentId,
      teamId: authorization.principal.teamId,
      employeeId: authorization.principal.userId,
      type: body.type,
      title: body.title,
      description: body.description,
      amount,
      currency: BASE_CURRENCY,
      ...(conversion ? { conversion } : {}),
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
        metadata: { amount: newExpense.amount, currency: newExpense.currency, ...conversionAuditDetails(conversion) },
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
    const existingExpense = await getRecord<Expense>(
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
      return apiError(422, "Please correct the highlighted fields.", "VALIDATION_ERROR", { fieldErrors: body.fieldErrors });
    }

    const periodError = await checkBudgetPeriod(existingExpense, body.expenseDate, false);
    if (periodError) return periodError;

    // Converted again on every save, so a changed amount, currency or date
    // takes its own rate and an approximate rate is replaced when possible.
    const { amount, conversion } = await toRupees(body.amount, body.currency, body.expenseDate);
    const { conversion: _previousConversion, ...existingFields } = existingExpense;

    const updatedExpense: Expense = {
      ...existingFields,
      type: body.type,
      title: body.title,
      description: body.description,
      expenseDate: body.expenseDate,
      amount,
      currency: BASE_CURRENCY,
      ...(conversion ? { conversion } : {}),
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
          ...conversionAuditDetails(conversion),
          changes: [
            ...(["type", "title", "description", "amount", "expenseDate"] as const)
              .filter((field) => existingExpense[field] !== updatedExpense[field])
              .map((field) => ({
                field,
                previousValue: existingExpense[field],
                newValue: updatedExpense[field],
              })),
            // What was paid, when another currency is involved.
            ...((existingExpense.conversion || conversion) && paidAs(existingExpense) !== paidAs(updatedExpense)
              ? [{ field: "paidAs", previousValue: paidAs(existingExpense), newValue: paidAs(updatedExpense) }]
              : []),
          ],
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
    const expense = await getRecord<Expense>(
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

    const outcome = await submitDraftExpense(authorization.principal, expense);
    return outcome.ok
      ? HttpResponse.json(outcome.expense)
      : apiError(outcome.status, outcome.message, outcome.code, outcome.details);
  }),

  // Several of the user's drafts at once (§13). Each draft is authorized and
  // submitted exactly as by the single endpoint, in its own transaction; one
  // refusal does not stop the others.
  http.post("/api/expenses/bulk-submit", async ({ request }) => {
    const principalAuthorization = await authorizeRequest(request, {
      permission: "expenses.submit",
      scope: "ORGANIZATION",
    });

    if (principalAuthorization.allowed === false) {
      return authorizationError(principalAuthorization);
    }

    const payload = (await request.json().catch(() => null)) as { expenseIds?: unknown } | null;
    const expenseIds = payload?.expenseIds;
    if (
      !Array.isArray(expenseIds) ||
      expenseIds.length === 0 ||
      expenseIds.length > MAX_BULK_SUBMIT ||
      !expenseIds.every((id): id is string => typeof id === "string" && id.length > 0) ||
      new Set(expenseIds).size !== expenseIds.length
    ) {
      return apiError(422, `Select between 1 and ${MAX_BULK_SUBMIT} different expenses to submit.`);
    }

    const results: BulkSubmitResult[] = [];
    for (const expenseId of expenseIds) {
      const expense = await getRecord<Expense>("expenses", expenseId);
      if (!expense) {
        results.push({ expenseId, ok: false, status: 404, code: "NOT_FOUND", message: "Expense not found." });
        continue;
      }

      const authorization = await authorizeOwnerOperation(request, expense, "expenses.submit", ["draft"]);
      if ("error" in authorization) {
        // The refusal the single endpoint would return for this draft.
        const refusal = (await authorization.error.json()) as { status: number; code: string; message: string };
        results.push({ expenseId, ok: false, status: refusal.status, code: refusal.code, message: refusal.message });
        continue;
      }

      const outcome = await submitDraftExpense(authorization.principal, expense);
      results.push(
        outcome.ok
          ? { expenseId, ok: true, expense: outcome.expense }
          : { expenseId, ok: false, status: outcome.status, code: outcome.code, message: outcome.message },
      );
    }

    return HttpResponse.json({ results });
  }),

  http.post("/api/expenses/:id/restore", async ({ params, request }) => {
    const expense = await getRecord<Expense>(
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
    const restoredExpense: Expense = {
      ...expense,
      status: transitionExpenseState("RESTORE", expense.status),
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
