import { http, HttpResponse } from "msw";

import {
  PAYMENT_METHOD_LABELS,
  PERSONAL_EXPENSE_TYPE_LABELS,
  type PaymentMethod,
  type PersonalBudget,
  type PersonalBudgetTypeLimit,
  type PersonalDocument,
  type PersonalExpense,
  type PersonalExpenseType,
  type PersonalSummary,
} from "../../features/personal/types/personal";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import { applyCollectionQueryResult, parseCollectionQuery } from "../../services/api/queryParams";
import { apiError } from "../services/apiError";
import { runAuditedTransaction, type AuditEventInput } from "../services/auditService";
import { getRecord, listRecordsByIndex } from "../services/mockDataService";
import {
  authorizePersonalRequest,
  breakdownByType,
  buildAnalytics,
  byNewest,
  currentMonth,
  isCalendarDate,
  isMonth,
  monthOf,
  shiftMonth,
  today,
  withUsage,
} from "../services/personalService";
import { formatCurrency } from "../../utils/currency";

const BASE = "/api/personal";
const MAX_AMOUNT = 10_000_000;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_DOCUMENTS_PER_EXPENSE = 5;
// Same limits as organization documents (§29).
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

interface StoredPersonalDocument extends PersonalDocument {
  content: Blob;
}

const toDocumentDto = ({ content: _content, ...document }: StoredPersonalDocument): PersonalDocument => document;

const roundAmount = (value: number) => Math.round(value * 100) / 100;

const validationError = (fieldErrors: Record<string, string>) =>
  apiError(422, "Please correct the highlighted fields.", "VALIDATION_ERROR", { fieldErrors });

/** Personal audit events carry the account's private namespace, so only its owner sees them (§24). */
function personalAudit(principal: AuthenticatedPrincipal, input: Omit<AuditEventInput, "organizationId" | "actorId">): AuditEventInput {
  return { ...input, organizationId: principal.organizationId, actorId: principal.userId };
}

const listOwnExpenses = (ownerId: string) => listRecordsByIndex<PersonalExpense>("personalExpenses", "ownerId", ownerId);
const listOwnBudgets = (ownerId: string) => listRecordsByIndex<PersonalBudget>("personalBudgets", "ownerId", ownerId);

/** Reads a record and hides it unless the signed-in account owns it. */
async function getOwned<T extends { ownerId: string }>(
  storeName: "personalExpenses" | "personalBudgets" | "personalDocuments",
  id: string,
  principal: AuthenticatedPrincipal,
): Promise<T | undefined> {
  const record = await getRecord<T>(storeName, id);
  return record && record.ownerId === principal.userId ? record : undefined;
}

function parseExpenseBody(body: Record<string, unknown>) {
  const fieldErrors: Record<string, string> = {};
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (typeof body.type !== "string" || !(body.type in PERSONAL_EXPENSE_TYPE_LABELS)) fieldErrors.type = "Choose an expense type.";
  if (typeof body.paymentMethod !== "string" || !(body.paymentMethod in PAYMENT_METHOD_LABELS)) fieldErrors.paymentMethod = "Choose a payment method.";
  if (!Number.isFinite(amount) || amount <= 0) fieldErrors.amount = "Enter an amount greater than zero.";
  else if (amount > MAX_AMOUNT) fieldErrors.amount = `The amount cannot exceed ${formatCurrency(MAX_AMOUNT)}.`;
  if (!isCalendarDate(body.expenseDate)) fieldErrors.expenseDate = "Enter a valid date.";
  else if (body.expenseDate > today()) fieldErrors.expenseDate = "The date cannot be in the future.";
  if (!description) fieldErrors.description = "Description is required.";
  else if (description.length > MAX_DESCRIPTION_LENGTH) fieldErrors.description = `Use at most ${MAX_DESCRIPTION_LENGTH} characters.`;

  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors } as const;
  return {
    ok: true,
    values: {
      type: body.type as PersonalExpenseType,
      paymentMethod: body.paymentMethod as PaymentMethod,
      amount: roundAmount(amount),
      expenseDate: body.expenseDate as string,
      description,
    },
  } as const;
}

function parseBudgetBody(body: Record<string, unknown>) {
  const fieldErrors: Record<string, string> = {};
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  const rawLimits = Array.isArray(body.typeLimits) ? body.typeLimits : [];
  const typeLimits: PersonalBudgetTypeLimit[] = [];

  if (!isMonth(body.month)) fieldErrors.month = "Choose a month.";
  if (!Number.isFinite(amount) || amount <= 0) fieldErrors.amount = "Enter a budget greater than zero.";
  else if (amount > MAX_AMOUNT) fieldErrors.amount = `The budget cannot exceed ${formatCurrency(MAX_AMOUNT)}.`;

  for (const item of rawLimits as Array<Record<string, unknown>>) {
    const limitAmount = typeof item?.amount === "number" ? item.amount : Number(item?.amount);
    if (typeof item?.type !== "string" || !(item.type in PERSONAL_EXPENSE_TYPE_LABELS)) {
      fieldErrors.typeLimits = "Each limit needs an expense type.";
    } else if (typeLimits.some((limit) => limit.type === item.type)) {
      fieldErrors.typeLimits = `${PERSONAL_EXPENSE_TYPE_LABELS[item.type as PersonalExpenseType]} has more than one limit.`;
    } else if (!Number.isFinite(limitAmount) || limitAmount <= 0) {
      fieldErrors.typeLimits = "Each limit must be greater than zero.";
    } else {
      typeLimits.push({ type: item.type as PersonalExpenseType, amount: roundAmount(limitAmount) });
    }
  }
  if (!fieldErrors.typeLimits && !fieldErrors.amount && typeLimits.reduce((total, limit) => total + limit.amount, 0) > amount) {
    fieldErrors.typeLimits = "Expense type limits cannot add up to more than the monthly budget.";
  }

  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors } as const;
  return { ok: true, values: { month: body.month as string, amount: roundAmount(amount), typeLimits } } as const;
}

export const personalHandlers = [
  // ---- Expenses ----------------------------------------------------------
  http.get(`${BASE}/expenses`, async ({ request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;

    const query = parseCollectionQuery(request);
    const { search, ...rest } = query;
    let expenses = (await listOwnExpenses(auth.principal.userId)).sort(byNewest);

    // Search matches what the user sees: description, labels and amount.
    if (search) {
      const needle = search.toLowerCase();
      expenses = expenses.filter((expense) =>
        [
          expense.description,
          PERSONAL_EXPENSE_TYPE_LABELS[expense.type],
          PAYMENT_METHOD_LABELS[expense.paymentMethod],
          String(expense.amount),
        ].some((value) => value.toLowerCase().includes(needle)));
    }

    return HttpResponse.json(applyCollectionQueryResult(expenses, rest));
  }),

  http.get(`${BASE}/expenses/:id`, async ({ params, request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;
    const expense = await getOwned<PersonalExpense>("personalExpenses", String(params.id), auth.principal);
    if (!expense) return apiError(404, "Expense not found.");
    return HttpResponse.json(expense);
  }),

  http.post(`${BASE}/expenses`, async ({ request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;

    const parsed = parseExpenseBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (!parsed.ok) return validationError(parsed.fieldErrors);

    const now = new Date().toISOString();
    const expense: PersonalExpense = {
      id: crypto.randomUUID(),
      ownerId: auth.principal.userId,
      ...parsed.values,
      currency: "INR",
      documentIds: [],
      createdAt: now,
      updatedAt: now,
    };

    await runAuditedTransaction(
      ["personalExpenses"],
      personalAudit(auth.principal, {
        action: "EXPENSE_CREATED",
        entityType: "EXPENSE",
        entityId: expense.id,
        metadata: { amount: expense.amount, type: expense.type },
        description: `Added personal expense "${expense.description}" for ${formatCurrency(expense.amount)}.`,
      }),
      (transaction) => {
        transaction.objectStore("personalExpenses").put(expense);
      },
    );

    return HttpResponse.json(expense, { status: 201 });
  }),

  http.put(`${BASE}/expenses/:id`, async ({ params, request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;
    const existing = await getOwned<PersonalExpense>("personalExpenses", String(params.id), auth.principal);
    if (!existing) return apiError(404, "Expense not found.");

    const parsed = parseExpenseBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (!parsed.ok) return validationError(parsed.fieldErrors);

    const updated: PersonalExpense = { ...existing, ...parsed.values, updatedAt: new Date().toISOString() };
    const changes = (["type", "amount", "expenseDate", "description", "paymentMethod"] as const)
      .filter((field) => existing[field] !== updated[field])
      .map((field) => ({ field, previousValue: existing[field], newValue: updated[field] }));

    await runAuditedTransaction(
      ["personalExpenses"],
      personalAudit(auth.principal, {
        action: "EXPENSE_UPDATED",
        entityType: "EXPENSE",
        entityId: updated.id,
        metadata: { changes },
        description: `Updated personal expense "${updated.description}".`,
      }),
      (transaction) => {
        transaction.objectStore("personalExpenses").put(updated);
      },
    );

    return HttpResponse.json(updated);
  }),

  http.delete(`${BASE}/expenses/:id`, async ({ params, request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;
    const existing = await getOwned<PersonalExpense>("personalExpenses", String(params.id), auth.principal);
    if (!existing) return apiError(404, "Expense not found.");

    const documents = await listRecordsByIndex<StoredPersonalDocument>("personalDocuments", "expenseId", existing.id);

    // The expense and its receipts are removed together.
    await runAuditedTransaction(
      ["personalExpenses", "personalDocuments"],
      personalAudit(auth.principal, {
        action: "EXPENSE_DELETED",
        entityType: "EXPENSE",
        entityId: existing.id,
        metadata: { amount: existing.amount, type: existing.type, documents: documents.length },
        description: `Deleted personal expense "${existing.description}".`,
      }),
      (transaction) => {
        transaction.objectStore("personalExpenses").delete(existing.id);
        for (const document of documents) transaction.objectStore("personalDocuments").delete(document.id);
      },
    );

    return new HttpResponse(null, { status: 204 });
  }),

  // ---- Receipts and documents -------------------------------------------
  http.get(`${BASE}/expenses/:id/documents`, async ({ params, request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;
    const expense = await getOwned<PersonalExpense>("personalExpenses", String(params.id), auth.principal);
    if (!expense) return apiError(404, "Expense not found.");

    const documents = await listRecordsByIndex<StoredPersonalDocument>("personalDocuments", "expenseId", expense.id);
    return HttpResponse.json(
      documents
        .filter((document) => document.ownerId === auth.principal.userId && document.status === "ACTIVE")
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map(toDocumentDto),
    );
  }),

  http.post(`${BASE}/expenses/:id/documents`, async ({ params, request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;
    const expense = await getOwned<PersonalExpense>("personalExpenses", String(params.id), auth.principal);
    if (!expense) return apiError(404, "Expense not found.");

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!(file instanceof File) || !file.name.trim()) return apiError(422, "A document file is required.");
    if (!ACCEPTED_FILE_TYPES.has(file.type)) return apiError(422, "Only JPG, PNG, and PDF documents are supported.");
    if (file.size > MAX_FILE_SIZE) return apiError(422, "Document size cannot exceed 5 MB.");
    if (expense.documentIds.length >= MAX_DOCUMENTS_PER_EXPENSE) {
      return apiError(422, `An expense can have at most ${MAX_DOCUMENTS_PER_EXPENSE} documents.`);
    }

    const now = new Date().toISOString();
    const document: StoredPersonalDocument = {
      id: crypto.randomUUID(),
      ownerId: auth.principal.userId,
      expenseId: expense.id,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      content: file,
    };
    const linkedExpense: PersonalExpense = { ...expense, documentIds: [...expense.documentIds, document.id], updatedAt: now };

    await runAuditedTransaction(
      ["personalDocuments", "personalExpenses"],
      personalAudit(auth.principal, {
        action: "DOCUMENT_UPLOADED",
        entityType: "DOCUMENT",
        entityId: document.id,
        metadata: { expenseId: expense.id, fileName: document.fileName, size: document.size },
        description: `Attached ${document.fileName} to "${expense.description}".`,
      }),
      (transaction) => {
        transaction.objectStore("personalDocuments").put(document);
        transaction.objectStore("personalExpenses").put(linkedExpense);
      },
    );

    return HttpResponse.json(toDocumentDto(document), { status: 201 });
  }),

  http.get(`${BASE}/documents/:id/content`, async ({ params, request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;
    const document = await getOwned<StoredPersonalDocument>("personalDocuments", String(params.id), auth.principal);
    if (!document || document.status !== "ACTIVE") return apiError(404, "Document not found.");

    return new HttpResponse(document.content, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${document.fileName.replace(/"/g, "")}"`,
      },
    });
  }),

  http.delete(`${BASE}/documents/:id`, async ({ params, request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;
    const document = await getOwned<StoredPersonalDocument>("personalDocuments", String(params.id), auth.principal);
    if (!document || document.status !== "ACTIVE") return apiError(404, "Document not found.");
    const expense = await getOwned<PersonalExpense>("personalExpenses", document.expenseId, auth.principal);

    const now = new Date().toISOString();
    await runAuditedTransaction(
      ["personalDocuments", "personalExpenses"],
      personalAudit(auth.principal, {
        action: "DOCUMENT_REMOVED",
        entityType: "DOCUMENT",
        entityId: document.id,
        metadata: { expenseId: document.expenseId, fileName: document.fileName },
        description: `Removed ${document.fileName}${expense ? ` from "${expense.description}"` : ""}.`,
      }),
      (transaction) => {
        transaction.objectStore("personalDocuments").delete(document.id);
        if (expense) {
          transaction.objectStore("personalExpenses").put({
            ...expense,
            documentIds: expense.documentIds.filter((id) => id !== document.id),
            updatedAt: now,
          });
        }
      },
    );

    return new HttpResponse(null, { status: 204 });
  }),

  // ---- Monthly budgets ---------------------------------------------------
  http.get(`${BASE}/budgets`, async ({ request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;
    const [budgets, expenses] = await Promise.all([
      listOwnBudgets(auth.principal.userId),
      listOwnExpenses(auth.principal.userId),
    ]);
    return HttpResponse.json(
      budgets
        .sort((left, right) => right.month.localeCompare(left.month))
        .map((budget) => withUsage(budget, expenses)),
    );
  }),

  http.post(`${BASE}/budgets`, async ({ request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;

    const parsed = parseBudgetBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (!parsed.ok) return validationError(parsed.fieldErrors);

    const budgets = await listOwnBudgets(auth.principal.userId);
    if (budgets.some((budget) => budget.month === parsed.values.month)) {
      return apiError(409, "You already have a budget for this month. Edit it instead.", "CONFLICT", {
        fieldErrors: { month: "A budget for this month already exists." },
      });
    }

    const now = new Date().toISOString();
    const budget: PersonalBudget = {
      id: crypto.randomUUID(),
      ownerId: auth.principal.userId,
      ...parsed.values,
      createdAt: now,
      updatedAt: now,
    };

    await runAuditedTransaction(
      ["personalBudgets"],
      personalAudit(auth.principal, {
        action: "BUDGET_CREATED",
        entityType: "BUDGET",
        entityId: budget.id,
        metadata: { month: budget.month, amount: budget.amount },
        description: `Created a ${formatCurrency(budget.amount)} budget for ${budget.month}.`,
      }),
      (transaction) => {
        transaction.objectStore("personalBudgets").put(budget);
      },
    );

    return HttpResponse.json(withUsage(budget, await listOwnExpenses(auth.principal.userId)), { status: 201 });
  }),

  http.put(`${BASE}/budgets/:id`, async ({ params, request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;
    const existing = await getOwned<PersonalBudget>("personalBudgets", String(params.id), auth.principal);
    if (!existing) return apiError(404, "Budget not found.");

    const parsed = parseBudgetBody((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (!parsed.ok) return validationError(parsed.fieldErrors);

    const budgets = await listOwnBudgets(auth.principal.userId);
    if (budgets.some((budget) => budget.id !== existing.id && budget.month === parsed.values.month)) {
      return apiError(409, "You already have a budget for this month.", "CONFLICT", {
        fieldErrors: { month: "A budget for this month already exists." },
      });
    }

    const updated: PersonalBudget = { ...existing, ...parsed.values, updatedAt: new Date().toISOString() };
    await runAuditedTransaction(
      ["personalBudgets"],
      personalAudit(auth.principal, {
        action: "BUDGET_UPDATED",
        entityType: "BUDGET",
        entityId: updated.id,
        metadata: { month: updated.month, previousAmount: existing.amount, amount: updated.amount },
        description: `Updated the budget for ${updated.month}.`,
      }),
      (transaction) => {
        transaction.objectStore("personalBudgets").put(updated);
      },
    );

    return HttpResponse.json(withUsage(updated, await listOwnExpenses(auth.principal.userId)));
  }),

  http.delete(`${BASE}/budgets/:id`, async ({ params, request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;
    const existing = await getOwned<PersonalBudget>("personalBudgets", String(params.id), auth.principal);
    if (!existing) return apiError(404, "Budget not found.");

    await runAuditedTransaction(
      ["personalBudgets"],
      personalAudit(auth.principal, {
        action: "BUDGET_DELETED",
        entityType: "BUDGET",
        entityId: existing.id,
        metadata: { month: existing.month, amount: existing.amount },
        description: `Deleted the budget for ${existing.month}.`,
      }),
      (transaction) => {
        transaction.objectStore("personalBudgets").delete(existing.id);
      },
    );

    return new HttpResponse(null, { status: 204 });
  }),

  // ---- Summary and analytics (derived, read-only) -------------------------
  http.get(`${BASE}/summary`, async ({ request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;

    const requested = new URL(request.url).searchParams.get("month");
    const month = isMonth(requested) ? requested : currentMonth();
    const previous = shiftMonth(month, -1);
    const [expenses, budgets] = await Promise.all([
      listOwnExpenses(auth.principal.userId),
      listOwnBudgets(auth.principal.userId),
    ]);
    const monthExpenses = expenses.filter((expense) => monthOf(expense.expenseDate) === month);
    const budget = budgets.find((item) => item.month === month);
    const total = (items: PersonalExpense[]) => roundAmount(items.reduce((sum, expense) => sum + expense.amount, 0));

    const summary: PersonalSummary = {
      month,
      monthSpent: total(monthExpenses),
      previousMonthSpent: total(expenses.filter((expense) => monthOf(expense.expenseDate) === previous)),
      monthCount: monthExpenses.length,
      budget: budget ? withUsage(budget, expenses) : null,
      byType: breakdownByType(monthExpenses),
      recent: [...expenses].sort(byNewest).slice(0, 5),
    };
    return HttpResponse.json(summary);
  }),

  http.get(`${BASE}/analytics`, async ({ request }) => {
    const auth = await authorizePersonalRequest(request);
    if ("error" in auth) return auth.error;

    const params = new URL(request.url).searchParams;
    const to = isMonth(params.get("to")) ? params.get("to")! : currentMonth();
    const from = isMonth(params.get("from")) ? params.get("from")! : shiftMonth(to, -5);
    if (from > to) return apiError(422, "The start month must be before the end month.");
    if (shiftMonth(from, 36) <= to) return apiError(422, "Choose a range of at most 36 months.");

    const [expenses, budgets] = await Promise.all([
      listOwnExpenses(auth.principal.userId),
      listOwnBudgets(auth.principal.userId),
    ]);
    return HttpResponse.json(buildAnalytics(expenses, budgets, from, to));
  }),
];
