import { describe, expect, it } from "vitest";

import type { BulkSubmitResult, Expense } from "../../features/expenses/types/expense";
import { listRecords, saveRecord } from "../services/mockDataService";
import {
  apiFetch,
  demoAccounts,
  failExchangeRateService,
  serveExchangeRates,
  signIn,
  setupApiServer,
} from "../../test/apiServer";
import {
  auditEventsFor,
  givenBudget,
  givenExpense,
  givenPolicy,
  readExpense,
  withFixedToday,
  type DemoRole,
} from "../../test/fixtures";

setupApiServer();

async function signInAs(role: DemoRole): Promise<string> {
  return signIn(demoAccounts[role].email, demoAccounts[role].password);
}

describe("GET /api/expenses", () => {
  it("refuses requests without a session", async () => {
    const response = await apiFetch("/api/expenses");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("returns only the signed-in employee's own expenses", async () => {
    const cookie = await signIn(demoAccounts.employee.email, demoAccounts.employee.password);

    const response = await apiFetch("/api/expenses", {}, cookie);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ ownerId: string }> };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.every((expense) => expense.ownerId === "user-1")).toBe(true);
  });
});

describe("submitting drafts", () => {
  const withReceipt = { status: "draft" as const, documentIds: ["document-1"] };

  function bulkSubmit(cookie: string | undefined, expenseIds: unknown): Promise<Response> {
    return apiFetch("/api/expenses/bulk-submit", { method: "POST", body: JSON.stringify({ expenseIds }) }, cookie);
  }

  it("submits a single draft with a receipt and audits it", async () => {
    const expense = await givenExpense(withReceipt);

    const response = await apiFetch(`/api/expenses/${expense.id}/submit`, { method: "POST" }, await signInAs("employee"));

    expect(response.status).toBe(200);
    expect(await readExpense(expense.id)).toMatchObject({ status: "submitted" });
    expect(await auditEventsFor(expense.id)).toEqual([expect.objectContaining({ action: "EXPENSE_SUBMITTED" })]);
  });

  it("refuses a single draft without a receipt with the reason and keeps it as a draft", async () => {
    const expense = await givenExpense({ status: "draft", documentIds: [] });

    const response = await apiFetch(`/api/expenses/${expense.id}/submit`, { method: "POST" }, await signInAs("employee"));

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "POLICY_VIOLATION", message: "A receipt or supporting document is required before submission." });
    expect(await readExpense(expense.id)).toMatchObject({ status: "draft" });
  });

  it("submits several drafts at once, each with its own audit event", async () => {
    const first = await givenExpense({ ...withReceipt, title: "Taxi" });
    const second = await givenExpense({ ...withReceipt, title: "Hotel" });

    const response = await bulkSubmit(await signInAs("employee"), [first.id, second.id]);

    expect(response.status).toBe(200);
    const { results } = (await response.json()) as { results: BulkSubmitResult[] };
    expect(results).toEqual([
      expect.objectContaining({ expenseId: first.id, ok: true, expense: expect.objectContaining({ status: "submitted" }) }),
      expect.objectContaining({ expenseId: second.id, ok: true }),
    ]);
    for (const expense of [first, second]) {
      expect(await readExpense(expense.id)).toMatchObject({ status: "submitted" });
      expect(await auditEventsFor(expense.id)).toEqual([expect.objectContaining({ action: "EXPENSE_SUBMITTED", actorId: "user-1" })]);
    }
  });

  it("submits what it can and explains each draft it could not submit", async () => {
    await givenPolicy({ rules: { maximumAmount: { amount: 500, enforcement: "BLOCK" } } });
    const accepted = await givenExpense({ ...withReceipt, amount: 400 });
    const tooLarge = await givenExpense({ ...withReceipt, amount: 1_000 });
    const noReceipt = await givenExpense({ status: "draft", documentIds: [], amount: 100 });
    const alreadySubmitted = await givenExpense({ status: "submitted", documentIds: ["document-1"], amount: 100 });
    const someoneElses = await givenExpense({ ...withReceipt, owner: "manager", amount: 100 });

    const response = await bulkSubmit(await signInAs("employee"), [
      accepted.id, tooLarge.id, noReceipt.id, alreadySubmitted.id, someoneElses.id, "missing",
    ]);

    const { results } = (await response.json()) as { results: BulkSubmitResult[] };
    expect(results.map((result) => [result.expenseId, result.ok ? 200 : result.status])).toEqual([
      [accepted.id, 200],
      [tooLarge.id, 422],
      [noReceipt.id, 422],
      [alreadySubmitted.id, 403],
      [someoneElses.id, 404],
      ["missing", 404],
    ]);
    expect(results[1]).toMatchObject({ code: "POLICY_VIOLATION", message: "Amount exceeds the maximum of ₹500 per expense." });
    expect(results[2]).toMatchObject({ message: "A receipt or supporting document is required before submission." });
    expect(await readExpense(accepted.id)).toMatchObject({ status: "submitted" });
    expect(await readExpense(tooLarge.id)).toMatchObject({ status: "draft" });
    expect(await readExpense(someoneElses.id)).toMatchObject({ status: "draft" });
    expect(await auditEventsFor(tooLarge.id)).toEqual([expect.objectContaining({ action: "EXPENSE_SUBMISSION_REJECTED" })]);
    expect(await auditEventsFor(someoneElses.id)).toEqual([]);
  });

  it.each([
    ["an empty list", []],
    ["a missing list", undefined],
    ["more than 25 drafts", Array.from({ length: 26 }, (_, index) => `expense-${index}`)],
    ["the same draft twice", ["expense-1", "expense-1"]],
    ["values that are not expenses", [42]],
  ])("refuses %s and changes nothing", async (_case, expenseIds) => {
    const expense = await givenExpense(withReceipt);

    const response = await bulkSubmit(await signInAs("employee"), expenseIds ?? undefined);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ message: "Select between 1 and 25 different expenses to submit." });
    expect(await readExpense(expense.id)).toMatchObject({ status: "draft" });
  });

  it("refuses accounts without permission to submit organization expenses", async () => {
    const expense = await givenExpense(withReceipt);

    const response = await bulkSubmit(await signIn(demoAccounts.personal.email, demoAccounts.personal.password), [expense.id]);

    expect(response.status).toBe(403);
    expect(await readExpense(expense.id)).toMatchObject({ status: "draft" });
  });

  it("requires signing in", async () => {
    const expense = await givenExpense(withReceipt);

    expect((await bulkSubmit(undefined, [expense.id])).status).toBe(401);
    expect(await readExpense(expense.id)).toMatchObject({ status: "draft" });
  });
});

describe("amounts paid in other currencies", () => {
  // A Monday: an expense dated the Saturday before takes Friday's rate.
  withFixedToday("2026-10-19");

  const lunch = { type: "MEALS", title: "Client lunch", description: "Lunch with a client in New York", expenseDate: "2026-10-17" };

  function saveExpense(cookie: string, body: Record<string, unknown>, id?: string): Promise<Response> {
    return apiFetch(id ? `/api/expenses/${id}` : "/api/expenses", { method: id ? "PUT" : "POST", body: JSON.stringify(body) }, cookie);
  }

  /** Creates a draft through the API and gives it a receipt, ready to submit. */
  async function givenDraftPaidInDollars(cookie: string): Promise<Expense> {
    const created = (await (await saveExpense(cookie, { ...lunch, amount: 60, currency: "USD" })).json()) as Expense;
    await saveRecord("expenses", { ...created, documentIds: ["document-1"] });
    return created;
  }

  it("keeps the expense in rupees, with the amount as paid and the rate of its date", async () => {
    await givenBudget();
    serveExchangeRates({ USD: 94.96 });

    const response = await saveExpense(await signInAs("employee"), { ...lunch, amount: 60, currency: "USD" });

    expect(response.status).toBe(201);
    const expense = (await response.json()) as Expense;
    expect(expense).toMatchObject({
      amount: 5_697.6,
      currency: "INR",
      conversion: { originalAmount: 60, originalCurrency: "USD", rate: 94.96, rateDate: "2026-10-16", source: "ECB" },
    });
    expect(await readExpense(expense.id)).toMatchObject({ amount: 5_697.6, conversion: { originalCurrency: "USD" } });
    expect(await auditEventsFor(expense.id)).toEqual([
      expect.objectContaining({
        action: "EXPENSE_CREATED",
        metadata: {
          amount: 5_697.6,
          currency: "INR",
          paidAs: "USD 60.00",
          exchangeRate: "1 USD = ₹94.96, the European Central Bank rate for 16 Oct 2026",
        },
      }),
    ]);
  });

  it("applies policy limits to the rupee amount", async () => {
    await givenBudget();
    await givenPolicy({ rules: { maximumAmount: { amount: 5_000, enforcement: "BLOCK" } } });
    serveExchangeRates({ USD: 94.96 });
    const cookie = await signInAs("employee");
    const expense = await givenDraftPaidInDollars(cookie);

    const response = await apiFetch(`/api/expenses/${expense.id}/submit`, { method: "POST" }, cookie);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ message: "Amount exceeds the maximum of ₹5,000 per expense." });
  });

  it("converts again when the draft changes, and keeps no conversion for rupees", async () => {
    await givenBudget();
    serveExchangeRates({ USD: 94.96, EUR: 106.86 });
    const cookie = await signInAs("employee");
    const created = (await (await saveExpense(cookie, { ...lunch, amount: 60, currency: "USD" })).json()) as Expense;

    const inEuros = await saveExpense(cookie, { ...lunch, amount: 50, currency: "EUR" }, created.id);
    expect(await inEuros.json()).toMatchObject({ amount: 5_343, conversion: { originalAmount: 50, originalCurrency: "EUR", rate: 106.86 } });

    const inRupees = await saveExpense(cookie, { ...lunch, amount: 4_500, currency: "INR" }, created.id);
    expect(await inRupees.json()).toEqual(expect.not.objectContaining({ conversion: expect.anything() }));
    expect(await readExpense(created.id)).toEqual(expect.objectContaining({ amount: 4_500, currency: "INR" }));
    expect(await readExpense(created.id)).not.toHaveProperty("conversion");

    const updates = (await auditEventsFor(created.id)).filter((event) => event.action === "EXPENSE_UPDATED");
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metadata: expect.objectContaining({
          paidAs: "EUR 50.00",
          changes: expect.arrayContaining([{ field: "paidAs", previousValue: "USD 60.00", newValue: "EUR 50.00" }]),
        }),
      }),
      expect.objectContaining({
        metadata: expect.objectContaining({
          changes: expect.arrayContaining([{ field: "paidAs", previousValue: "EUR 50.00", newValue: "₹4,500" }]),
        }),
      }),
    ]));
  });

  it("uses an approximate rate when current rates cannot be retrieved", async () => {
    await givenBudget();
    failExchangeRateService();

    const response = await saveExpense(await signInAs("employee"), { ...lunch, amount: 60, currency: "USD" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      amount: 5_697.89,
      conversion: { originalAmount: 60, rate: 94.9649, rateDate: "2026-10-16", source: "REFERENCE" },
    });
  });

  it("refuses a currency it cannot convert and stores nothing", async () => {
    await givenBudget();

    const response = await saveExpense(await signInAs("employee"), { ...lunch, amount: 60, currency: "AED" });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ details: { fieldErrors: { currency: "Choose a supported currency." } } });
    expect(await listRecords("expenses")).toEqual([]);
  });

  it("recognises a duplicate paid in the same currency even when the rupee amounts differ", async () => {
    await givenBudget();
    await givenPolicy({ rules: { duplicateCheck: { enforcement: "BLOCK" } } });
    await givenExpense({
      type: "MEALS",
      expenseDate: "2026-10-17",
      status: "submitted",
      amount: 5_697.89,
      conversion: { originalAmount: 60, originalCurrency: "USD", rate: 94.9649, rateDate: "2026-10-16", source: "REFERENCE" },
    });
    serveExchangeRates({ USD: 94.96 });
    const cookie = await signInAs("employee");
    const expense = await givenDraftPaidInDollars(cookie);

    const response = await apiFetch(`/api/expenses/${expense.id}/submit`, { method: "POST" }, cookie);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ message: "Another expense by the same person has the same type, amount and date." });
  });
});
