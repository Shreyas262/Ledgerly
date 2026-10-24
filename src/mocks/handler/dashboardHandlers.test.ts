import { describe, expect, it } from "vitest";

import type { DashboardSummary } from "../../features/dashboard/types/dashboard";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";
import { givenBudget, givenExpense, withFixedToday, type DemoRole } from "../../test/fixtures";

setupApiServer();
withFixedToday("2026-10-16");

async function dashboard(as: DemoRole, query = ""): Promise<DashboardSummary> {
  const cookie = await signIn(demoAccounts[as].email, demoAccounts[as].password);
  const response = await apiFetch(`/api/dashboard/summary${query}`, {}, cookie);
  expect(response.status).toBe(200);
  return (await response.json()) as DashboardSummary;
}

describe("GET /api/dashboard/summary for the user's own expenses", () => {
  it("adds rupee totals to the status counts within the date range", async () => {
    await givenExpense({ status: "submitted", amount: 200, expenseDate: "2026-10-05" });
    await givenExpense({ status: "under_review", amount: 300, expenseDate: "2026-10-06" });
    await givenExpense({ status: "approved", amount: 1_000, expenseDate: "2026-10-07" });
    await givenExpense({ status: "rejected", amount: 450, expenseDate: "2026-10-08" });
    await givenExpense({ status: "approved", amount: 9_999, expenseDate: "2026-09-01" });

    const { kpis } = await dashboard("employee", "?from=2026-10-01&to=2026-10-31");

    expect(kpis).toMatchObject({
      pendingApproval: 2,
      pendingAmount: 500,
      approvedExpenses: 1,
      approvedAmount: 1_000,
      rejectedExpenses: 1,
      rejectedAmount: 450,
    });
  });

  it("lists what needs attention and what is owed, whatever the date range", async () => {
    await givenExpense({ status: "draft", documentIds: ["document-1"], expenseDate: "2026-03-01" });
    await givenExpense({ status: "draft", documentIds: [], expenseDate: "2026-03-02" });
    await givenExpense({ status: "rejected", expenseDate: "2026-03-03" });
    await givenExpense({ status: "approved", amount: 1_000, expenseDate: "2026-03-04" });
    await givenExpense({ status: "reimbursement_pending", amount: 500, expenseDate: "2026-03-05" });
    await givenExpense({ status: "reimbursed", amount: 300, expenseDate: "2026-03-06" });

    const summary = await dashboard("employee", "?from=2026-10-01&to=2026-10-31");

    expect(summary.attention).toMatchObject({ drafts: 2, draftsWithoutReceipt: 1, rejected: 1 });
    expect(summary.owed).toEqual({ amount: 1_500, count: 2 });
  });

  it("shows the five latest expenses, newest first", async () => {
    for (const day of ["01", "09", "03", "07", "05", "02"]) {
      await givenExpense({ title: `Expense ${day}`, expenseDate: `2026-10-${day}` });
    }

    const { recent } = await dashboard("employee");

    expect(recent.map((expense) => expense.title)).toEqual(["Expense 09", "Expense 07", "Expense 05", "Expense 03", "Expense 02"]);
  });

  it("never includes other people's expenses", async () => {
    await givenExpense({ owner: "manager", status: "draft", title: "Manager's draft" });

    const summary = await dashboard("employee");

    expect(summary.attention.drafts).toBe(0);
    expect(summary.recent).toEqual([]);
  });

  it("says why expenses cannot be created while no budget is active", async () => {
    expect((await dashboard("employee")).attention.creationBlockedReason).toMatch(/no active budget/);

    await givenBudget();

    expect((await dashboard("employee")).attention.creationBlockedReason).toBeNull();
  });
});

describe("GET /api/dashboard/summary work queues", () => {
  it("gives an employee no work queues", async () => {
    await givenExpense({ owner: "manager", status: "submitted" });

    expect((await dashboard("employee")).workQueues).toEqual({ approvals: null, reimbursements: null, budgetAlerts: null });
  });

  it("counts a manager's approvals and how long the oldest has waited", async () => {
    await givenExpense({ status: "submitted", submittedAt: new Date("2026-10-10T08:00:00").toISOString() });
    await givenExpense({ status: "submitted", submittedAt: new Date("2026-10-14T08:00:00").toISOString() });
    await givenExpense({ status: "approved" });

    const { workQueues } = await dashboard("manager");

    expect(workQueues.approvals).toEqual({ count: 2, oldestWaitingDays: 6 });
    expect(workQueues.reimbursements).toBeNull();
  });

  it("counts only unpaid expenses as ready to reimburse for Finance", async () => {
    await givenExpense({ status: "approved", amount: 1_000 });
    await givenExpense({ status: "reimbursement_pending", amount: 250 });
    await givenExpense({ status: "reimbursed", amount: 9_000 });

    const { workQueues } = await dashboard("finance");

    expect(workQueues.reimbursements).toEqual({ count: 2, amount: 1_250 });
  });

  it("flags budgets at 80% or more, at the viewer's level", async () => {
    const { budget } = await givenBudget();
    // 45,000 of the Engineering team's 50,000 (90%); 45% of the department's 100,000.
    await givenExpense({ status: "reimbursed", amount: 45_000, expenseDate: "2026-06-01" });

    expect((await dashboard("manager")).workQueues.budgetAlerts).toEqual([
      { budgetId: budget.id, name: "Engineering team", utilizationPercent: 90 },
    ]);
    expect((await dashboard("finance")).workQueues.budgetAlerts).toEqual([]);
    expect((await dashboard("admin")).workQueues.budgetAlerts).toEqual([]);
  });
});
