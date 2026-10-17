import { describe, expect, it } from "vitest";

import type { BulkSubmitResult } from "../../features/expenses/types/expense";
import { apiFetch, demoAccounts, signIn, setupApiServer } from "../../test/apiServer";
import { auditEventsFor, givenExpense, givenPolicy, readExpense, type DemoRole } from "../../test/fixtures";

setupApiServer();

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

  async function signInAs(role: DemoRole): Promise<string> {
    return signIn(demoAccounts[role].email, demoAccounts[role].password);
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
