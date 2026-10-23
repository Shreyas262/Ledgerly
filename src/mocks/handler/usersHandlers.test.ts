import { describe, expect, it } from "vitest";

import type { Expense } from "../../features/expenses/types/expense";
import { getRecord } from "../services/mockDataService";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";
import { givenExpense, readExpense, type DemoRole } from "../../test/fixtures";

setupApiServer();

function signInAs(role: DemoRole): Promise<string> {
  return signIn(demoAccounts[role].email, demoAccounts[role].password);
}

function deleteUser(id: string, cookie: string): Promise<Response> {
  return apiFetch(`/api/users/${id}`, { method: "DELETE" }, cookie);
}

// §27.3: removing users.
describe("deleting a user", () => {
  it.each<Expense["status"]>(["submitted", "under_review", "approved", "reimbursement_pending"])(
    "is refused while an expense is %s, steering to deactivation",
    async (status) => {
      await givenExpense({ owner: "employee", status: "reimbursed" });
      await givenExpense({ owner: "employee", status });

      const response = await deleteUser("user-1", await signInAs("admin"));

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        code: "HAS_UNFINISHED_EXPENSES",
        message: "John Employee has 1 expense in review or awaiting reimbursement. Deactivate the user instead, or delete them once those expenses are completed.",
      });
      expect(await getRecord("users", "user-1")).toMatchObject({ status: "active" });
    },
  );

  it("keeps a user with completed expense history as removed and cancels their drafts", async () => {
    const reimbursed = await givenExpense({ owner: "employee", status: "reimbursed" });
    const draft = await givenExpense({ owner: "employee", status: "draft" });

    const response = await deleteUser("user-1", await signInAs("admin"));

    expect(response.status).toBe(204);
    expect(await getRecord("users", "user-1")).toMatchObject({ status: "deleted" });
    expect(await readExpense(reimbursed.id)).toMatchObject({ status: "reimbursed", employeeId: "user-1" });
    expect(await readExpense(draft.id)).toMatchObject({ status: "cancelled" });
  });

  it("deletes a user without expense history outright", async () => {
    const response = await deleteUser("user-1", await signInAs("admin"));

    expect(response.status).toBe(204);
    expect(await getRecord("users", "user-1")).toBeUndefined();
  });

  it("is refused to users without the permission", async () => {
    const response = await deleteUser("user-1", await signInAs("manager"));

    expect(response.status).toBe(403);
    expect(await getRecord("users", "user-1")).toMatchObject({ status: "active" });
  });
});
