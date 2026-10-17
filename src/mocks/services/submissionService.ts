import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type { Expense } from "../../features/expenses/types/expense";
import { getBudgetWarnings } from "./budgetService";
import { evaluateExpensePolicy, isSubmissionAllowed, persistExpenseSubmissionEvaluation } from "./policyService";

export type SubmissionOutcome =
  | { ok: true; expense: Expense }
  | { ok: false; status: 422; code: "POLICY_VIOLATION"; message: string; details: Record<string, unknown> };

/**
 * Submits a draft the principal has been authorized to submit (§13). The
 * policy is evaluated and the result is stored with its audit event, whether
 * the submission is accepted or refused. Accepted submissions carry
 * non-blocking budget warnings.
 */
export async function submitDraftExpense(principal: AuthenticatedPrincipal, expense: Expense): Promise<SubmissionOutcome> {
  const evaluation = await evaluateExpensePolicy(expense);
  const submissionAllowed = isSubmissionAllowed(evaluation);

  await persistExpenseSubmissionEvaluation(
    expense,
    evaluation,
    submissionAllowed,
    {
      organizationId: expense.organizationId,
      actorId: principal.userId,
      action: submissionAllowed ? "EXPENSE_SUBMITTED" : "EXPENSE_SUBMISSION_REJECTED",
      entityType: "EXPENSE",
      entityId: expense.id,
      previousState: expense.status,
      newState: submissionAllowed ? "submitted" : expense.status,
      metadata: { policyId: evaluation.policyId, evaluationResult: evaluation.result },
      description: submissionAllowed
        ? `Submitted expense ${expense.title} for review.`
        : `Submission of expense ${expense.title} was blocked by policy.`,
    },
  );

  const evaluatedExpense: Expense = {
    ...expense,
    status: submissionAllowed ? "submitted" : expense.status,
    policyId: evaluation.policyId,
    policyEvaluation: evaluation,
    ...(submissionAllowed ? { submittedAt: evaluation.evaluatedAt } : {}),
    updatedAt: evaluation.evaluatedAt,
  };

  if (!submissionAllowed) {
    return {
      ok: false,
      status: 422,
      code: "POLICY_VIOLATION",
      message:
        evaluation.result === "MISSING_INFORMATION"
          ? (evaluation.details.missingInformation ?? []).join(" ") ||
            "Expense is missing information required by the applicable policy."
          : (evaluation.details.violatedRules ?? []).join(" ") ||
            "Expense violates the applicable policy.",
      details: { evaluation, expense: evaluatedExpense },
    };
  }

  // Non-blocking: tell the submitter if this expense would exceed a budget.
  const budgetWarnings = await getBudgetWarnings(evaluatedExpense);
  return { ok: true, expense: { ...evaluatedExpense, ...(budgetWarnings.length ? { budgetWarnings } : {}) } };
}
