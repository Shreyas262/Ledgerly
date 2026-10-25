import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppNotification } from "../../features/notifications/types/notification";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";
import { givenBudget, givenExpense, type DemoRole } from "../../test/fixtures";

setupApiServer();

// Comments are ordered by time; each one is written a minute after the last.
let clock = new Date("2026-10-16T10:00:00.000Z").getTime();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(clock);
});
afterEach(() => {
  vi.useRealTimers();
});

function signInAs(role: DemoRole): Promise<string> {
  return signIn(demoAccounts[role].email, demoAccounts[role].password);
}

async function comment(expenseId: string, role: DemoRole, body: string): Promise<void> {
  clock += 60_000;
  vi.setSystemTime(clock);
  const response = await apiFetch(`/api/expenses/${expenseId}/comments`, { method: "POST", body: JSON.stringify({ body }) }, await signInAs(role));
  expect(response.status).toBe(201);
}

async function commentNotifications(role: DemoRole): Promise<AppNotification[]> {
  const response = await apiFetch("/api/notifications", {}, await signInAs(role));
  expect(response.status).toBe(200);
  const { data } = (await response.json()) as { data: AppNotification[] };
  return data.filter((notification) => notification.category === "COMMENTS");
}

describe("comment notifications", () => {
  it("tells the owner about a reviewer's comment and links to the expense", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review", title: "Hotel in Pune" });
    await comment(expense.id, "manager", "Please attach the GST invoice.");

    const [notification] = await commentNotifications("employee");

    expect(notification).toMatchObject({
      category: "COMMENTS",
      title: "New comment",
      message: expect.stringMatching(/ commented on "Hotel in Pune": "Please attach the GST invoice\."$/),
      link: `/expenses/${expense.id}`,
    });
  });

  it("tells the reviewer about the owner's comment before the reviewer has written", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review", reviewedBy: "user-2" });
    await comment(expense.id, "employee", "The invoice is attached.");

    expect(await commentNotifications("manager")).toHaveLength(1);
  });

  it("tells the reviewer who started the review, before they decide", async () => {
    const expense = await givenExpense({ owner: "employee", status: "submitted" });
    const review = await apiFetch(`/api/expenses/${expense.id}/review`, { method: "POST" }, await signInAs("manager"));
    expect(review.status).toBe(200);
    await comment(expense.id, "employee", "The invoice is attached.");

    expect(await commentNotifications("manager")).toHaveLength(1);
  });

  it("tells earlier commenters about later replies, not about comments before they joined", async () => {
    const expense = await givenExpense({ owner: "manager", status: "approved" });
    await comment(expense.id, "manager", "Paid by card.");
    await comment(expense.id, "finance", "Which card?");
    await comment(expense.id, "manager", "The corporate card.");

    const notifications = await commentNotifications("finance");

    expect(notifications.map((notification) => notification.message)).toEqual([
      expect.stringContaining('"The corporate card."'),
    ]);
  });

  it("does not tell users about their own comments or about threads they are not part of", async () => {
    const expense = await givenExpense({ owner: "employee", status: "submitted" });
    await comment(expense.id, "employee", "Submitted for the client visit.");

    expect(await commentNotifications("employee")).toEqual([]);
    // The administrator may open the expense but has not taken part.
    expect(await commentNotifications("admin")).toEqual([]);
  });

  it("stops once the user can no longer open the expense", async () => {
    const expense = await givenExpense({ owner: "employee", status: "submitted" });
    await comment(expense.id, "manager", "Is this the Pune trip?");
    await comment(expense.id, "employee", "Yes, it is.");
    // The expense now belongs to another team, outside the manager's scope.
    await givenExpense({ ...expense, teamId: "team-finance" });

    expect(await commentNotifications("manager")).toEqual([]);
  });

  it("shortens long comments in the notification", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review" });
    await comment(expense.id, "manager", `${"word ".repeat(30)}end`);

    const [notification] = await commentNotifications("employee");

    expect(notification.message).toMatch(/word…"$/);
    expect(notification.message).not.toContain("end");
  });
});

// §28.19: budget viewers are warned about budgets at their level.
describe("budget forecast notifications", () => {
  async function budgetNotices(role: DemoRole): Promise<AppNotification[]> {
    const response = await apiFetch("/api/notifications", {}, await signInAs(role));
    const { data } = (await response.json()) as { data: AppNotification[] };
    return data.filter((notification) => notification.category === "BUDGET_ALERTS");
  }

  it("warns about a team budget projected to exceed its allocation, at the viewer's level only", async () => {
    const { budget } = await givenBudget();
    // 45,000 of the Engineering team's 50,000 by mid-October heads past 50,000 before the year ends.
    await givenExpense({ status: "reimbursed", amount: 45_000, expenseDate: "2026-06-01" });

    expect(await budgetNotices("manager")).toEqual([
      expect.objectContaining({
        severity: "warning",
        title: "Budget forecast",
        message: expect.stringMatching(/^The Engineering team budget is projected to exceed its allocation by ₹[\d,.]+, running out around \d+ Nov 2026\.$/),
        link: `/budgets/${budget.id}`,
      }),
    ]);
    expect(await budgetNotices("finance")).toEqual([]);
  });

  it("says when reimbursed and approved spend already exceeds the allocation", async () => {
    await givenBudget();
    await givenExpense({ owner: "finance", status: "approved", amount: 120_000, expenseDate: "2026-10-01" });

    expect((await budgetNotices("finance")).map((notification) => notification.message)).toEqual([
      "The Finance department budget has reimbursed and approved spend ₹20,000 above its allocation.",
    ]);
  });
});
