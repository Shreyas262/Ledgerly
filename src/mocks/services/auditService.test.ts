import { describe, expect, it } from "vitest";

import { auditEventsFor, givenExpense, readExpense } from "../../test/fixtures";
import { runAuditedTransaction, type AuditEventInput } from "./auditService";

function auditFor(entityId: string): AuditEventInput {
  return {
    organizationId: "org-1",
    actorId: "user-2",
    action: "EXPENSE_APPROVED",
    entityType: "EXPENSE",
    entityId,
    previousState: "under_review",
    newState: "approved",
  };
}

// §23.5: the entity change and its audit event are written together or not at all.
describe("runAuditedTransaction", () => {
  it("persists the change and its audit event together", async () => {
    const expense = await givenExpense({ status: "under_review" });

    await runAuditedTransaction(["expenses"], auditFor(expense.id), (transaction) => {
      transaction.objectStore("expenses").put({ ...expense, status: "approved" });
    });

    expect(await readExpense(expense.id)).toMatchObject({ status: "approved" });
    expect(await auditEventsFor(expense.id)).toEqual([
      expect.objectContaining({ action: "EXPENSE_APPROVED", actorId: "user-2", previousState: "under_review", newState: "approved" }),
    ]);
  });

  it("persists neither when the change fails", async () => {
    const expense = await givenExpense({ status: "under_review" });

    await expect(
      runAuditedTransaction(["expenses"], auditFor(expense.id), (transaction) => {
        transaction.objectStore("expenses").put({ ...expense, status: "approved" });
        throw new Error("Business rule failed after the write was queued.");
      }),
    ).rejects.toThrow("Business rule failed");

    expect(await readExpense(expense.id)).toMatchObject({ status: "under_review" });
    expect(await auditEventsFor(expense.id)).toEqual([]);
  });

  it("persists neither when a write is rejected by the database", async () => {
    const expense = await givenExpense({ status: "under_review" });

    await expect(
      runAuditedTransaction(["expenses"], auditFor(expense.id), (transaction) => {
        transaction.objectStore("expenses").put({ ...expense, status: "approved" });
        // A record without its key path cannot be stored.
        transaction.objectStore("expenses").put({ status: "approved" });
      }),
    ).rejects.toBeDefined();

    expect(await readExpense(expense.id)).toMatchObject({ status: "under_review" });
    expect(await auditEventsFor(expense.id)).toEqual([]);
  });
});
