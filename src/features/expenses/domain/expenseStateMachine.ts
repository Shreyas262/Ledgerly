import type { ExpenseStatus } from "../types/expense";

export type ExpenseTransition =
  | "SUBMIT"
  | "START_REVIEW"
  | "APPROVE"
  | "REJECT"
  | "RESTORE"
  | "START_REIMBURSEMENT"
  | "REIMBURSE"
  | "CANCEL";

export interface ExpenseTransitionDefinition {
  transition: ExpenseTransition;
  from: ExpenseStatus;
  to: ExpenseStatus;
}

const transitions: readonly ExpenseTransitionDefinition[] = [
  { transition: "SUBMIT", from: "draft", to: "submitted" },
  { transition: "START_REVIEW", from: "submitted", to: "under_review" },
  { transition: "APPROVE", from: "under_review", to: "approved" },
  { transition: "REJECT", from: "under_review", to: "rejected" },
  { transition: "RESTORE", from: "rejected", to: "draft" },
  {
    transition: "START_REIMBURSEMENT",
    from: "approved",
    to: "reimbursement_pending",
  },
  {
    transition: "REIMBURSE",
    from: "reimbursement_pending",
    to: "reimbursed",
  },
  { transition: "CANCEL", from: "approved", to: "cancelled" },
  {
    transition: "CANCEL",
    from: "reimbursement_pending",
    to: "cancelled",
  },
  { transition: "CANCEL", from: "draft", to: "cancelled" },
];

export function getExpenseTransition(
  transition: ExpenseTransition,
  currentState: ExpenseStatus,
): ExpenseTransitionDefinition | null {
  return (
    transitions.find(
      (definition) =>
        definition.transition === transition &&
        definition.from === currentState,
    ) ?? null
  );
}

export function transitionExpenseState(
  transition: ExpenseTransition,
  currentState: ExpenseStatus,
): ExpenseStatus {
  const definition = getExpenseTransition(transition, currentState);

  if (!definition) {
    throw new Error(
      `Invalid expense transition: ${transition} from ${currentState}.`,
    );
  }

  return definition.to;
}
