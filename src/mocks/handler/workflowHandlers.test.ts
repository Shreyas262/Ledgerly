import { describe, expect, it } from "vitest";

import type { Expense } from "../../features/expenses/types/expense";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";
import { auditEventsFor, givenBudget, givenExpense, givenSecondAdmin, readExpense, type DemoRole } from "../../test/fixtures";

setupApiServer();

function signInAs(role: DemoRole): Promise<string> {
  return signIn(demoAccounts[role].email, demoAccounts[role].password);
}

function post(path: string, cookie: string, body?: unknown): Promise<Response> {
  return apiFetch(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, cookie);
}

const escalation = {
  result: "REQUIRES_APPROVAL" as const,
  evaluatedAt: "2026-10-01T10:00:00.000Z",
  details: { escalated: true, approvalThreshold: 5_000 },
};

async function queueIds(path: string, cookie: string): Promise<string[]> {
  const response = await apiFetch(path, {}, cookie);
  expect(response.status).toBe(200);
  return ((await response.json()) as Expense[]).map((expense) => expense.id).sort();
}

describe("approval queue", () => {
  it("lists for each reviewer only what the approval matrix lets them review", async () => {
    const memberExpense = await givenExpense({ owner: "employee" });
    const escalatedMemberExpense = await givenExpense({ owner: "employee", policyEvaluation: escalation });
    const managerExpense = await givenExpense({ owner: "manager" });
    const financeExpense = await givenExpense({ owner: "finance" });
    await givenExpense({ owner: "employee", status: "draft" });
    await givenExpense({ owner: "employee", status: "approved" });

    expect(await queueIds("/api/approvals", await signInAs("manager"))).toEqual([memberExpense.id]);
    expect(await queueIds("/api/approvals", await signInAs("finance"))).toEqual(
      [escalatedMemberExpense.id, managerExpense.id].sort(),
    );
    expect(await queueIds("/api/approvals", await signInAs("admin"))).toEqual(
      [memberExpense.id, escalatedMemberExpense.id, managerExpense.id, financeExpense.id].sort(),
    );
  });

  it("is refused to employees", async () => {
    const response = await apiFetch("/api/approvals", {}, await signInAs("employee"));
    expect(response.status).toBe(403);
  });
});

describe("review ownership", () => {
  it("records who started the review", async () => {
    const expense = await givenExpense({ owner: "employee" });

    expect((await post(`/api/expenses/${expense.id}/review`, await signInAs("manager"))).status).toBe(200);

    expect(await readExpense(expense.id)).toMatchObject({ status: "under_review", reviewStartedBy: "user-2" });
    const queue = (await (await apiFetch("/api/approvals", {}, await signInAs("admin"))).json()) as Expense[];
    expect(queue.find((item) => item.id === expense.id)).toMatchObject({ reviewStartedByName: "Sarah Manager" });
  });

  it("refuses another reviewer who is not an administrator", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review", reviewStartedBy: "user-3" });
    const manager = await signInAs("manager");

    const approve = await post(`/api/expenses/${expense.id}/approve`, manager);
    expect(approve.status).toBe(403);
    expect(await approve.json()).toMatchObject({
      message: "Mike Finance started this review, so only they or an administrator can approve or reject it.",
    });
    expect((await post(`/api/expenses/${expense.id}/reject`, manager, { reason: "Missing bill" })).status).toBe(403);
    expect(await readExpense(expense.id)).toMatchObject({ status: "under_review", reviewStartedBy: "user-3" });
  });

  it("lets an administrator take a review over and records whose review was overridden", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review", reviewStartedBy: "user-2" });

    expect((await post(`/api/expenses/${expense.id}/approve`, await signInAs("admin"))).status).toBe(200);

    expect(await readExpense(expense.id)).toMatchObject({ status: "approved", reviewedBy: "user-4" });
    expect(await auditEventsFor(expense.id)).toEqual([
      expect.objectContaining({
        action: "EXPENSE_APPROVED",
        metadata: { overriddenReviewerId: "user-2" },
        description: "Approved expense Client lunch, overriding the review started by Sarah Manager.",
      }),
    ]);
  });

  it("records an administrator's takeover when rejecting too", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review", reviewStartedBy: "user-2" });

    expect((await post(`/api/expenses/${expense.id}/reject`, await signInAs("admin"), { reason: "Missing bill" })).status).toBe(200);

    expect(await auditEventsFor(expense.id)).toEqual([
      expect.objectContaining({ action: "EXPENSE_REJECTED", metadata: { reason: "Missing bill", overriddenReviewerId: "user-2" } }),
    ]);
  });
});

describe("administrators' own expenses", () => {
  it("refuses an administrator their own expense and leaves it out of their queue", async () => {
    const expense = await givenExpense({ owner: "admin" });
    const admin = await signInAs("admin");

    expect(await queueIds("/api/approvals", admin)).not.toContain(expense.id);
    const response = await post(`/api/expenses/${expense.id}/review`, admin);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ message: "You cannot review your own expense." });
    expect(await readExpense(expense.id)).toMatchObject({ status: "submitted" });
  });

  it("routes the only administrator's expense to Finance for their department", async () => {
    const expense = await givenExpense({ owner: "admin" });
    const finance = await signInAs("finance");

    expect(await queueIds("/api/approvals", finance)).toContain(expense.id);
    expect((await post(`/api/expenses/${expense.id}/review`, finance)).status).toBe(200);
    expect((await post(`/api/expenses/${expense.id}/approve`, finance)).status).toBe(200);
    expect(await readExpense(expense.id)).toMatchObject({ status: "approved", approvedBy: "user-3" });
  });

  it("leaves an administrator's expense to another administrator when there is one", async () => {
    await givenSecondAdmin();
    const expense = await givenExpense({ owner: "admin" });
    const finance = await signInAs("finance");

    expect(await queueIds("/api/approvals", finance)).not.toContain(expense.id);
    expect((await post(`/api/expenses/${expense.id}/review`, finance)).status).toBe(403);
    expect(await readExpense(expense.id)).toMatchObject({ status: "submitted" });
  });
});

describe("review, approve and reject", () => {
  it("lets the team manager review and approve, auditing each step", async () => {
    const expense = await givenExpense({ owner: "employee" });
    const manager = await signInAs("manager");

    expect((await post(`/api/expenses/${expense.id}/review`, manager)).status).toBe(200);
    expect((await post(`/api/expenses/${expense.id}/approve`, manager)).status).toBe(200);

    expect(await readExpense(expense.id)).toMatchObject({ status: "approved", approvedBy: "user-2" });
    const events = await auditEventsFor(expense.id);
    expect(events).toHaveLength(2);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "EXPENSE_REVIEWED", actorId: "user-2", previousState: "submitted", newState: "under_review" }),
        expect.objectContaining({ action: "EXPENSE_APPROVED", actorId: "user-2", previousState: "under_review", newState: "approved" }),
      ]),
    );
  });

  it("refuses a manager their own expense and leaves it unchanged", async () => {
    const expense = await givenExpense({ owner: "manager" });

    const response = await post(`/api/expenses/${expense.id}/review`, await signInAs("manager"));

    expect(response.status).toBe(403);
    expect(await readExpense(expense.id)).toMatchObject({ status: "submitted" });
    expect(await auditEventsFor(expense.id)).toEqual([]);
  });

  it("refuses Finance an expense submitted by a Finance user", async () => {
    const expense = await givenExpense({ owner: "finance" });
    const response = await post(`/api/expenses/${expense.id}/review`, await signInAs("finance"));
    expect(response.status).toBe(403);
  });

  it("refuses to approve an expense that is not under review", async () => {
    const expense = await givenExpense({ owner: "employee", status: "submitted" });

    const response = await post(`/api/expenses/${expense.id}/approve`, await signInAs("manager"));

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string; message: string };
    expect(body).toMatchObject({
      code: "INVALID_STATE_TRANSITION",
      message: "This action is no longer available because the expense is now submitted. Refresh to see its current status.",
    });
    // No internal transition or status identifiers in user-facing text.
    expect(body.message).not.toMatch(/APPROVE|_/);
  });

  it("requires a reason to reject, and shows it to the owner", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review" });
    const manager = await signInAs("manager");

    const withoutReason = await post(`/api/expenses/${expense.id}/reject`, manager, { reason: "   " });
    expect(withoutReason.status).toBe(422);
    expect(await readExpense(expense.id)).toMatchObject({ status: "under_review" });

    const rejected = await post(`/api/expenses/${expense.id}/reject`, manager, { reason: "Missing itemised bill" });
    expect(rejected.status).toBe(200);
    expect(await readExpense(expense.id)).toMatchObject({
      status: "rejected",
      rejectedBy: "user-2",
      rejectionReason: "Missing itemised bill",
    });
    expect(await auditEventsFor(expense.id)).toEqual([
      expect.objectContaining({ action: "EXPENSE_REJECTED", metadata: { reason: "Missing itemised bill" } }),
    ]);
  });

  it("does not reveal another user's draft to a reviewer", async () => {
    const expense = await givenExpense({ owner: "employee", status: "draft" });
    const response = await post(`/api/expenses/${expense.id}/review`, await signInAs("admin"));
    expect(response.status).toBe(404);
  });

  it("refuses an expense from another organization", async () => {
    const expense = await givenExpense({ owner: "employee", organizationId: "org-2" });

    const response = await post(`/api/expenses/${expense.id}/review`, await signInAs("admin"));

    expect(response.status).toBe(403);
    expect(await readExpense(expense.id)).toMatchObject({ status: "submitted" });
  });
});

describe("reimbursement", () => {
  it("lets Finance process an approved expense to reimbursed", async () => {
    const expense = await givenExpense({ owner: "employee", status: "approved", approvedBy: "user-2" });
    const finance = await signInAs("finance");

    expect(await queueIds("/api/reimbursements", finance)).toContain(expense.id);
    expect((await post(`/api/expenses/${expense.id}/start-reimbursement`, finance)).status).toBe(200);
    expect((await post(`/api/expenses/${expense.id}/reimburse`, finance)).status).toBe(200);

    expect(await readExpense(expense.id)).toMatchObject({
      status: "reimbursed",
      reimbursement: { status: "REIMBURSED", amount: 1_000, processedBy: "user-3" },
    });
    expect((await auditEventsFor(expense.id)).map((event) => event.action).sort()).toEqual([
      "REIMBURSEMENT_COMPLETED",
      "REIMBURSEMENT_STARTED",
    ]);
  });

  it("refuses Finance an expense it approved (separation of duties)", async () => {
    const expense = await givenExpense({ owner: "manager", status: "approved", approvedBy: "user-3" });

    const response = await post(`/api/expenses/${expense.id}/start-reimbursement`, await signInAs("finance"));

    expect(response.status).toBe(403);
    expect(await readExpense(expense.id)).toMatchObject({ status: "approved" });
  });

  it("leaves Finance-owned expenses to an administrator", async () => {
    const expense = await givenExpense({ owner: "finance", status: "approved", approvedBy: "user-4" });
    const finance = await signInAs("finance");

    expect(await queueIds("/api/reimbursements", finance)).not.toContain(expense.id);
    expect((await post(`/api/expenses/${expense.id}/start-reimbursement`, finance)).status).toBe(403);
    expect((await post(`/api/expenses/${expense.id}/start-reimbursement`, await signInAs("admin"))).status).toBe(200);
  });

  it("refuses an administrator their own expense and leaves it out of their queue", async () => {
    await givenSecondAdmin();
    const expense = await givenExpense({ owner: "admin", status: "approved", approvedBy: "user-admin-2" });
    const admin = await signInAs("admin");

    expect(await queueIds("/api/reimbursements", admin)).not.toContain(expense.id);
    expect((await post(`/api/expenses/${expense.id}/start-reimbursement`, admin)).status).toBe(403);
    expect(await readExpense(expense.id)).toMatchObject({ status: "approved" });
  });

  it("lets Finance reimburse the only administrator's expense it approved", async () => {
    const expense = await givenExpense({ owner: "admin", status: "approved", approvedBy: "user-3" });
    const finance = await signInAs("finance");

    const queue = (await (await apiFetch("/api/reimbursements", {}, finance)).json()) as Expense[];
    expect(queue.find((item) => item.id === expense.id)).toMatchObject({ approverMayReimburse: true });
    expect((await post(`/api/expenses/${expense.id}/start-reimbursement`, finance)).status).toBe(200);
    expect((await post(`/api/expenses/${expense.id}/reimburse`, finance)).status).toBe(200);
    expect(await readExpense(expense.id)).toMatchObject({ status: "reimbursed" });
  });

  it("names a closed budget the reimbursement still counts against, and completes it", async () => {
    await givenBudget({ status: "closed", startDate: "2026-01-01", endDate: "2026-09-30" });
    await givenBudget({ startDate: "2026-10-01", endDate: "2026-12-31" });
    const inClosedPeriod = await givenExpense({ owner: "employee", status: "approved", approvedBy: "user-2", expenseDate: "2026-09-20" });
    const inActivePeriod = await givenExpense({ owner: "employee", status: "approved", approvedBy: "user-2", expenseDate: "2026-10-05" });
    const finance = await signInAs("finance");

    const queue = (await (await apiFetch("/api/reimbursements", {}, finance)).json()) as Expense[];
    expect(queue.find((item) => item.id === inClosedPeriod.id)).toMatchObject({ closedBudgetName: "Test budget" });
    expect(queue.find((item) => item.id === inActivePeriod.id)?.closedBudgetName).toBeUndefined();

    // Winding down a closed period stays possible.
    expect((await post(`/api/expenses/${inClosedPeriod.id}/start-reimbursement`, finance)).status).toBe(200);
    expect((await post(`/api/expenses/${inClosedPeriod.id}/reimburse`, finance)).status).toBe(200);
  });

  it("refuses managers", async () => {
    const expense = await givenExpense({ owner: "employee", status: "approved", approvedBy: "user-4" });
    const response = await post(`/api/expenses/${expense.id}/start-reimbursement`, await signInAs("manager"));
    expect(response.status).toBe(403);
  });
});

describe("financial cancellation", () => {
  it("requires a reason and records who cancelled", async () => {
    const expense = await givenExpense({ owner: "employee", status: "reimbursement_pending", approvedBy: "user-2" });
    const finance = await signInAs("finance");

    const withoutReason = await post(`/api/expenses/${expense.id}/cancel`, finance, {});
    expect(withoutReason.status).toBe(422);
    expect(await readExpense(expense.id)).toMatchObject({ status: "reimbursement_pending" });

    const cancelled = await post(`/api/expenses/${expense.id}/cancel`, finance, { reason: "Duplicate claim" });
    expect(cancelled.status).toBe(200);
    expect(await readExpense(expense.id)).toMatchObject({
      status: "cancelled",
      cancelledBy: "user-3",
      cancellationReason: "Duplicate claim",
      reimbursement: { status: "CANCELLED" },
    });
    expect(await auditEventsFor(expense.id)).toEqual([
      expect.objectContaining({ action: "EXPENSE_CANCELLED", previousState: "reimbursement_pending", newState: "cancelled" }),
    ]);
  });

  it("refuses to cancel a reimbursed expense", async () => {
    const expense = await givenExpense({ owner: "employee", status: "reimbursed", approvedBy: "user-2" });

    const response = await post(`/api/expenses/${expense.id}/cancel`, await signInAs("admin"), { reason: "Too late" });

    expect(response.status).toBe(409);
    expect(await readExpense(expense.id)).toMatchObject({ status: "reimbursed" });
  });
});
