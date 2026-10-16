import { describe, expect, it } from "vitest";

import type { ExpenseStatus } from "../types/expense";
import { transitionExpenseState, type ExpenseTransition } from "./expenseStateMachine";

const STATUSES: ExpenseStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "rejected",
  "approved",
  "reimbursement_pending",
  "reimbursed",
  "cancelled",
];

// §35: the only permitted transitions.
const ALLOWED: Array<[ExpenseTransition, ExpenseStatus, ExpenseStatus]> = [
  ["SUBMIT", "draft", "submitted"],
  ["START_REVIEW", "submitted", "under_review"],
  ["APPROVE", "under_review", "approved"],
  ["REJECT", "under_review", "rejected"],
  ["RESTORE", "rejected", "draft"],
  ["START_REIMBURSEMENT", "approved", "reimbursement_pending"],
  ["REIMBURSE", "reimbursement_pending", "reimbursed"],
  ["CANCEL", "draft", "cancelled"],
  ["CANCEL", "approved", "cancelled"],
  ["CANCEL", "reimbursement_pending", "cancelled"],
];

const TRANSITIONS = [...new Set(ALLOWED.map(([transition]) => transition))];

const INVALID = TRANSITIONS.flatMap((transition) =>
  STATUSES.filter(
    (from) => !ALLOWED.some(([allowed, allowedFrom]) => allowed === transition && allowedFrom === from),
  ).map((from) => [transition, from] as const),
);

describe("expense state machine", () => {
  it.each(ALLOWED)("%s moves %s to %s", (transition, from, to) => {
    expect(transitionExpenseState(transition, from)).toBe(to);
  });

  it.each(INVALID)("refuses %s from %s", (transition, from) => {
    expect(() => transitionExpenseState(transition, from)).toThrow("Invalid expense transition");
  });

  it("allows no transition out of a reimbursed or cancelled expense", () => {
    for (const transition of TRANSITIONS) {
      expect(() => transitionExpenseState(transition, "reimbursed")).toThrow();
      expect(() => transitionExpenseState(transition, "cancelled")).toThrow();
    }
  });
});
