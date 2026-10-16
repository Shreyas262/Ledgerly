import {
  getExpenseTransition,
  type ExpenseTransition,
} from "../../features/expenses/domain/expenseStateMachine";
import { EXPENSE_STATUS_LABELS, type ExpenseStatus } from "../../features/expenses/types/expense";

/**
 * A refused workflow operation. Services throw it with the status, code and
 * user-facing message the API returns, so handlers never interpret messages.
 */
export class WorkflowError extends Error {
  readonly status: 403 | 409 | 422;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: 403 | 409 | 422, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "WorkflowError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function workflowForbidden(message: string): WorkflowError {
  return new WorkflowError(403, "FORBIDDEN", message);
}

export function workflowReasonRequired(message: string): WorkflowError {
  return new WorkflowError(422, "VALIDATION_ERROR", message, { fieldErrors: { reason: message } });
}

/**
 * The status the transition leads to. Refuses with 409 when the expense has
 * moved on, typically because someone else acted on it first.
 */
export function transitionOrConflict(
  transition: ExpenseTransition,
  currentState: ExpenseStatus,
): ExpenseStatus {
  const definition = getExpenseTransition(transition, currentState);
  if (!definition) {
    throw new WorkflowError(
      409,
      "INVALID_STATE_TRANSITION",
      `This action is no longer available because the expense is now ${EXPENSE_STATUS_LABELS[currentState].toLowerCase()}. Refresh to see its current status.`,
    );
  }
  return definition.to;
}
