import { describe, expect, it } from "vitest";

import type { DelegationView } from "../../features/approvals/types/delegation";
import type { Expense } from "../../features/expenses/types/expense";
import type { UserActivity } from "../../features/activity/types/activity";
import type { AppNotification } from "../../features/notifications/types/notification";
import { getRecord, saveRecord } from "../services/mockDataService";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";
import { auditEventsFor, givenExpense, givenUser, readExpense, withFixedToday, type DemoRole } from "../../test/fixtures";

setupApiServer();
withFixedToday("2026-10-26");

function signInAs(role: DemoRole): Promise<string> {
  return signIn(demoAccounts[role].email, demoAccounts[role].password);
}

function post(path: string, cookie: string, body?: unknown): Promise<Response> {
  return apiFetch(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, cookie);
}

async function delegate(fromCookie: string, delegateId: string, startDate = "2026-10-26", endDate = "2026-11-06"): Promise<DelegationView> {
  const response = await post("/api/delegations", fromCookie, { delegateId, startDate, endDate });
  expect(response.status).toBe(201);
  return (await response.json()) as DelegationView;
}

async function queue(cookie: string): Promise<Expense[]> {
  const response = await apiFetch("/api/approvals", {}, cookie);
  expect(response.status).toBe(200);
  return (await response.json()) as Expense[];
}

/** Priya Manager runs the Administration team and may act for Sarah Manager; her own scope is her team. */
async function signInAsSecondManager(): Promise<string> {
  const user = await givenUser({ id: "user-manager-2", name: "Priya Manager", role: "manager", teamId: "team-operations", departmentId: "dept-operations" });
  return signIn(user.email, user.password);
}

/** Ravi Finance is authorized for Operations only. */
async function signInAsSecondFinance(): Promise<string> {
  const user = await givenUser({ id: "user-finance-2", name: "Ravi Finance", role: "finance", teamId: "team-finance", departmentId: "dept-finance", financeDepartmentIds: ["dept-operations"] });
  return signIn(user.email, user.password);
}

const escalation = {
  result: "REQUIRES_APPROVAL" as const,
  evaluatedAt: "2026-10-01T10:00:00.000Z",
  details: { escalated: true, approvalThreshold: 5_000 },
};

// §22.12: a delegate reviews what the delegator may review, on their behalf.
describe("reviewing on someone's behalf", () => {
  it("adds the delegator's reviews to the delegate's queue, marked with whom they act for", async () => {
    const memberExpense = await givenExpense({ owner: "employee" });
    const managerExpense = await givenExpense({ owner: "manager" });
    const finance = await signInAs("finance");
    expect((await queue(finance)).map((expense) => expense.id)).toEqual([managerExpense.id]);

    await delegate(await signInAs("manager"), "user-3");

    const items = await queue(finance);
    expect(items.find((expense) => expense.id === memberExpense.id)).toMatchObject({ actingOnBehalfOfId: "user-2", actingOnBehalfOfName: "Sarah Manager" });
    expect(items.find((expense) => expense.id === managerExpense.id)).not.toHaveProperty("actingOnBehalfOfId");
  });

  it("records a review and approval on the delegator's behalf on the expense and in the audit log", async () => {
    const expense = await givenExpense({ owner: "employee" });
    await delegate(await signInAs("manager"), "user-3");
    const finance = await signInAs("finance");

    expect((await post(`/api/expenses/${expense.id}/review`, finance)).status).toBe(200);
    expect(await readExpense(expense.id)).toMatchObject({ reviewStartedBy: "user-3", reviewStartedOnBehalfOf: "user-2" });
    expect((await post(`/api/expenses/${expense.id}/approve`, finance)).status).toBe(200);

    expect(await readExpense(expense.id)).toMatchObject({ status: "approved", approvedBy: "user-3", approvedOnBehalfOf: "user-2" });
    // Every event shares the fixed time, so their order is not asserted.
    const events = await auditEventsFor(expense.id);
    expect(events).toHaveLength(2);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "EXPENSE_REVIEWED", actorId: "user-3", metadata: { onBehalfOf: "user-2" }, description: "Started review for expense Client lunch on behalf of Sarah Manager." }),
      expect.objectContaining({ action: "EXPENSE_APPROVED", actorId: "user-3", metadata: { onBehalfOf: "user-2" }, description: "Approved expense Client lunch on behalf of Sarah Manager." }),
    ]));
  });

  it("tells the owner who rejected the expense and for whom", async () => {
    const expense = await givenExpense({ owner: "employee", title: "Taxi" });
    await delegate(await signInAs("manager"), "user-3");
    const finance = await signInAs("finance");
    await post(`/api/expenses/${expense.id}/review`, finance);

    expect((await post(`/api/expenses/${expense.id}/reject`, finance, { reason: "Missing bill" })).status).toBe(200);

    const employee = await signInAs("employee");
    expect(await (await apiFetch(`/api/expenses/${expense.id}`, {}, employee)).json()).toMatchObject({
      rejectedBy: "user-3",
      rejectedByName: "Mike Finance",
      rejectedOnBehalfOf: "user-2",
      rejectedOnBehalfOfName: "Sarah Manager",
    });
    const { data } = (await (await apiFetch("/api/notifications", {}, employee)).json()) as { data: AppNotification[] };
    expect(data.map((notification) => notification.message)).toContain('"Taxi" was rejected by Mike Finance on behalf of Sarah Manager. Reason: Missing bill');
  });

  it("reviews in the delegate's own right when they may review anyway", async () => {
    const expense = await givenExpense({ owner: "employee", policyEvaluation: escalation });
    await delegate(await signInAs("manager"), "user-3");
    const finance = await signInAs("finance");

    expect((await queue(finance)).find((item) => item.id === expense.id)).not.toHaveProperty("actingOnBehalfOfId");
    await post(`/api/expenses/${expense.id}/review`, finance);

    expect(await readExpense(expense.id)).not.toHaveProperty("reviewStartedOnBehalfOf");
    expect((await auditEventsFor(expense.id))[0]).not.toHaveProperty("metadata");
  });

  it.each([
    ["has not started", { startDate: "2026-10-28", endDate: "2026-11-06" }],
    ["has ended", { startDate: "2026-10-01", endDate: "2026-10-25" }],
    ["was cancelled", { cancelledAt: "2026-10-26T09:00:00.000Z" }],
  ])("grants nothing when the delegation %s", async (_name, change) => {
    const expense = await givenExpense({ owner: "employee" });
    const created = await delegate(await signInAs("manager"), "user-3");
    await saveRecord("delegations", { ...(await getRecord<DelegationView>("delegations", created.id))!, ...change });
    const finance = await signInAs("finance");

    expect((await queue(finance)).map((item) => item.id)).not.toContain(expense.id);
    expect((await post(`/api/expenses/${expense.id}/review`, finance)).status).toBe(403);
    expect(await readExpense(expense.id)).toMatchObject({ status: "submitted" });
  });

  it("stops once the delegator is no longer active, and says why", async () => {
    const expense = await givenExpense({ owner: "employee" });
    await delegate(await signInAs("manager"), "user-3");
    const sarah = await getRecord<Record<string, unknown>>("users", "user-2");
    await saveRecord("users", { ...sarah, status: "inactive" });
    const finance = await signInAs("finance");

    expect((await post(`/api/expenses/${expense.id}/review`, finance)).status).toBe(403);
    const { received } = (await (await apiFetch("/api/delegations", {}, finance)).json()) as { received: DelegationView[] };
    expect(received[0]).toMatchObject({ status: "active", inEffect: false, notInEffectReason: "Sarah Manager is no longer active." });
  });

  it("does not pass a delegation on", async () => {
    const expense = await givenExpense({ owner: "employee" });
    const ravi = await signInAsSecondFinance();
    await delegate(await signInAs("manager"), "user-3");
    await delegate(await signInAs("finance"), "user-finance-2");

    expect((await queue(ravi)).map((item) => item.id)).not.toContain(expense.id);
    expect((await post(`/api/expenses/${expense.id}/review`, ravi)).status).toBe(403);
  });
});

describe("reviews in progress and delegation", () => {
  it("lets the delegate finish a review the delegator started, without an override", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review", reviewStartedBy: "user-2" });
    await delegate(await signInAs("manager"), "user-3");

    expect((await post(`/api/expenses/${expense.id}/approve`, await signInAs("finance"))).status).toBe(200);

    expect(await readExpense(expense.id)).toMatchObject({ status: "approved", approvedOnBehalfOf: "user-2" });
    expect((await auditEventsFor(expense.id))[0].metadata).toEqual({ onBehalfOf: "user-2" });
  });

  it("lets the delegator finish a review started on their behalf after the delegation ends", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review", reviewStartedBy: "user-3", reviewStartedOnBehalfOf: "user-2" });
    const manager = await signInAs("manager");
    const created = await delegate(manager, "user-3");
    await post(`/api/delegations/${created.id}/cancel`, manager);

    expect((await post(`/api/expenses/${expense.id}/approve`, await signInAs("finance"))).status).toBe(403);
    expect((await post(`/api/expenses/${expense.id}/approve`, manager)).status).toBe(200);
    expect(await readExpense(expense.id)).toMatchObject({ status: "approved", approvedBy: "user-2" });
    expect(await readExpense(expense.id)).not.toHaveProperty("approvedOnBehalfOf");
  });

  it("names the review in progress and whom it was started for", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review", reviewStartedBy: "user-3", reviewStartedOnBehalfOf: "user-2" });

    expect(await (await apiFetch(`/api/expenses/${expense.id}`, {}, await signInAs("employee"))).json()).toMatchObject({
      reviewStartedByName: "Mike Finance",
      reviewStartedOnBehalfOfName: "Sarah Manager",
    });
  });
});

describe("separation of duties with delegation", () => {
  it("refuses the reimbursement to the Finance user an expense was approved for", async () => {
    // Mike Finance lends his authority to Ravi Finance, who approves a manager's expense for him.
    const expense = await givenExpense({ owner: "manager" });
    const ravi = await signInAsSecondFinance();
    await delegate(await signInAs("finance"), "user-finance-2");
    await post(`/api/expenses/${expense.id}/review`, ravi);
    expect((await post(`/api/expenses/${expense.id}/approve`, ravi)).status).toBe(200);
    expect(await readExpense(expense.id)).toMatchObject({ approvedBy: "user-finance-2", approvedOnBehalfOf: "user-3" });

    const response = await post(`/api/expenses/${expense.id}/start-reimbursement`, await signInAs("finance"));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      message: "This expense was approved on your behalf, so another authorized user must process its reimbursement.",
    });
    expect((await post(`/api/expenses/${expense.id}/start-reimbursement`, await signInAs("admin"))).status).toBe(200);
  });
});

// §12.2: a delegate opens what is in their delegated queue and keeps what they reviewed.
describe("reading delegated expenses", () => {
  it("opens an expense in the delegated queue with its documents and comments", async () => {
    const expense = await givenExpense({ owner: "employee" });
    const priya = await signInAsSecondManager();
    expect((await apiFetch(`/api/expenses/${expense.id}`, {}, priya)).status).toBe(403);

    await delegate(await signInAs("manager"), "user-manager-2");

    expect(await (await apiFetch(`/api/expenses/${expense.id}`, {}, priya)).json()).toMatchObject({
      id: expense.id,
      actingOnBehalfOfId: "user-2",
      actingOnBehalfOfName: "Sarah Manager",
    });
    expect((await apiFetch(`/api/expenses/${expense.id}/documents`, {}, priya)).status).toBe(200);
    expect((await apiFetch(`/api/expenses/${expense.id}/comments`, {}, priya)).status).toBe(200);
    expect((await post(`/api/expenses/${expense.id}/comments`, priya, { body: "Which client was this?" })).status).toBe(201);
  });

  it("keeps the reviewed expense open after deciding, but nothing else of the delegator's team", async () => {
    const expense = await givenExpense({ owner: "employee" });
    const unrelated = await givenExpense({ owner: "employee", status: "approved" });
    const priya = await signInAsSecondManager();
    const manager = await signInAs("manager");
    const created = await delegate(manager, "user-manager-2");

    await post(`/api/expenses/${expense.id}/review`, priya);
    expect((await post(`/api/expenses/${expense.id}/approve`, priya)).status).toBe(200);
    await post(`/api/delegations/${created.id}/cancel`, manager);

    expect((await apiFetch(`/api/expenses/${expense.id}`, {}, priya)).status).toBe(200);
    const refused = await apiFetch(`/api/expenses/${unrelated.id}`, {}, priya);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ message: "You do not have access to records outside your assigned scope." });
  });
});

describe("visibility of delegated reviews", () => {
  it("tells the delegate about the delegation and counts delegated reviews in the queue summary", async () => {
    await givenExpense({ owner: "employee" });
    const manager = await signInAs("manager");
    const first = await delegate(manager, "user-3");
    await post(`/api/delegations/${first.id}/cancel`, manager);
    await delegate(manager, "user-3", "2026-10-26", "2026-11-13");

    const { data } = (await (await apiFetch("/api/notifications", {}, await signInAs("finance"))).json()) as { data: AppNotification[] };

    expect(data.map((notification) => notification.message)).toEqual(expect.arrayContaining([
      "Sarah Manager delegated expense reviews to you from 26 Oct 2026 to 6 Nov 2026.",
      "Sarah Manager cancelled the delegation of expense reviews to you (26 Oct 2026 to 6 Nov 2026).",
      "Sarah Manager delegated expense reviews to you from 26 Oct 2026 to 13 Nov 2026.",
      "1 expense is in your review queue, 1 not yet started and 1 on behalf of others.",
    ]));
    expect(data.find((notification) => notification.title === "Reviews delegated to you")).toMatchObject({ category: "REVIEW_QUEUE", link: "/approvals" });
  });

  it("lists reviews done on the delegator's behalf in their Activity", async () => {
    const expense = await givenExpense({ owner: "employee" });
    await delegate(await signInAs("manager"), "user-3");
    const finance = await signInAs("finance");
    await post(`/api/expenses/${expense.id}/review`, finance);

    const { data } = (await (await apiFetch("/api/activity", {}, await signInAs("manager"))).json()) as { data: UserActivity[] };

    expect(data.find((activity) => activity.actedOnBehalfBy)).toMatchObject({
      action: "EXPENSE_REVIEWED",
      description: "Started review for expense Client lunch on behalf of Sarah Manager.",
      actedOnBehalfBy: "Mike Finance",
    });
  });
});
