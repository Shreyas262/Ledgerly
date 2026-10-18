import { describe, expect, it } from "vitest";

import type { ExpenseComment, ExpenseCommentThread } from "../../features/expenses/types/comment";
import { listRecords } from "../services/mockDataService";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";
import { auditEventsFor, givenExpense, type DemoRole } from "../../test/fixtures";

setupApiServer();

function signInAs(role: DemoRole): Promise<string> {
  return signIn(demoAccounts[role].email, demoAccounts[role].password);
}

function postComment(expenseId: string, cookie: string, body: unknown): Promise<Response> {
  return apiFetch(`/api/expenses/${expenseId}/comments`, { method: "POST", body: JSON.stringify({ body }) }, cookie);
}

async function readThread(expenseId: string, cookie: string): Promise<ExpenseCommentThread> {
  const response = await apiFetch(`/api/expenses/${expenseId}/comments`, {}, cookie);
  expect(response.status).toBe(200);
  return (await response.json()) as ExpenseCommentThread;
}

describe("expense comments", () => {
  it("lets the owner and the reviewer discuss an expense, oldest comment first", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review" });
    const employee = await signInAs("employee");
    const manager = await signInAs("manager");

    const asked = await postComment(expense.id, manager, "  Please attach the GST invoice.  ");
    expect(asked.status).toBe(201);
    expect(await asked.json()).toMatchObject({ authorId: "user-2", authorRole: "manager", body: "Please attach the GST invoice." });
    expect((await postComment(expense.id, employee, "Attached it now.\nThank you.")).status).toBe(201);

    const thread = await readThread(expense.id, employee);
    expect(thread.canComment).toBe(true);
    expect(thread.comments.map((comment) => [comment.authorId, comment.body])).toEqual([
      ["user-2", "Please attach the GST invoice."],
      ["user-1", "Attached it now.\nThank you."],
    ]);
    expect(thread.comments[0].authorName).toEqual(expect.any(String));
  });

  it.each<DemoRole>(["finance", "admin"])("lets %s comment on an expense within their scope", async (role) => {
    const expense = await givenExpense({ owner: "manager", status: "approved" });

    expect((await postComment(expense.id, await signInAs(role), "Checked against the travel policy.")).status).toBe(201);
  });

  it("writes each comment together with its audit event, without the text", async () => {
    const expense = await givenExpense({ owner: "employee", status: "submitted" });

    const response = await postComment(expense.id, await signInAs("manager"), "Which client was this for?");
    const comment = (await response.json()) as ExpenseComment;

    expect(await listRecords("expenseComments")).toEqual([expect.objectContaining({ id: comment.id, expenseId: expense.id })]);
    expect(await auditEventsFor(expense.id)).toEqual([
      expect.objectContaining({
        action: "EXPENSE_COMMENTED",
        entityType: "EXPENSE",
        actorId: "user-2",
        metadata: { commentId: comment.id, length: 26 },
      }),
    ]);
  });

  it("refuses users who cannot open the expense, and stores nothing", async () => {
    const managerExpense = await givenExpense({ owner: "manager", status: "submitted" });
    const financeExpense = await givenExpense({ owner: "finance", status: "submitted" });
    const outsideFinance = await givenExpense({ owner: "employee", status: "submitted", departmentId: "dept-unassigned" });
    const otherOrganization = await givenExpense({ owner: "employee", status: "submitted", organizationId: "org-2" });
    const someoneElsesDraft = await givenExpense({ owner: "manager", status: "draft" });

    const refusals: Array<[DemoRole, string, number]> = [
      ["employee", managerExpense.id, 403],
      ["manager", financeExpense.id, 403],
      ["finance", outsideFinance.id, 403],
      ["admin", otherOrganization.id, 403],
      ["admin", someoneElsesDraft.id, 404],
    ];
    for (const [role, expenseId, status] of refusals) {
      const cookie = await signInAs(role);
      expect((await postComment(expenseId, cookie, "Hello")).status).toBe(status);
      expect((await apiFetch(`/api/expenses/${expenseId}/comments`, {}, cookie)).status).toBe(status);
    }
    expect(await listRecords("expenseComments")).toEqual([]);
  });

  it("requires signing in", async () => {
    const expense = await givenExpense({ status: "submitted" });

    expect((await apiFetch(`/api/expenses/${expense.id}/comments`)).status).toBe(401);
    expect((await apiFetch(`/api/expenses/${expense.id}/comments`, { method: "POST", body: JSON.stringify({ body: "Hi" }) })).status).toBe(401);
  });

  it("answers not found for an expense that does not exist", async () => {
    expect((await postComment("missing", await signInAs("admin"), "Hello")).status).toBe(404);
  });

  it.each([
    ["draft", "Comments can be added once the expense has been submitted."],
    ["reimbursed", "Comments are closed because this expense has been reimbursed."],
    ["cancelled", "Comments are closed because this expense has been cancelled."],
  ] as const)("keeps the thread of a %s expense readable but closed", async (status, reason) => {
    const expense = await givenExpense({ owner: "employee", status: "under_review" });
    const employee = await signInAs("employee");
    await postComment(expense.id, await signInAs("manager"), "Looks fine.");
    await givenExpense({ ...expense, owner: "employee", status });

    const response = await postComment(expense.id, employee, "One more thing.");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ message: reason });

    const thread = await readThread(expense.id, employee);
    expect(thread).toMatchObject({ canComment: false, closedReason: reason });
    expect(thread.comments.map((comment) => comment.body)).toEqual(["Looks fine."]);
  });

  it.each(["rejected", "reimbursement_pending"] as const)("takes comments while the expense is %s", async (status) => {
    const expense = await givenExpense({ owner: "employee", status });

    expect((await postComment(expense.id, await signInAs("employee"), "Could you take another look?")).status).toBe(201);
  });

  it.each([
    ["an empty comment", "", "Enter a comment."],
    ["only spaces", "   \n ", "Enter a comment."],
    ["a missing comment", undefined, "Enter a comment."],
    ["more than 1,000 characters", "a".repeat(1_001), "Use at most 1000 characters."],
  ])("refuses %s", async (_case, body, message) => {
    const expense = await givenExpense({ owner: "employee", status: "submitted" });

    const response = await postComment(expense.id, await signInAs("employee"), body);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ details: { fieldErrors: { body: message } } });
    expect(await auditEventsFor(expense.id)).toEqual([]);
  });

  it("accepts a comment of exactly 1,000 characters", async () => {
    const expense = await givenExpense({ owner: "employee", status: "submitted" });

    expect((await postComment(expense.id, await signInAs("employee"), "a".repeat(1_000))).status).toBe(201);
  });
});
