import type { Expense } from "../types/expense";

/**
 * Who is reviewing an expense in review, as the viewer reads it: "In review
 * by you", or "In review by Mike Finance on behalf of Sarah Manager" when a
 * delegate started it (§22.4, §22.12). Null when no review is in progress.
 */
export function reviewInProgressLabel(expense: Expense, viewerId?: string): string | null {
  if (expense.status !== "under_review" || !expense.reviewStartedByName) return null;
  const reviewer = expense.reviewStartedBy === viewerId ? "you" : expense.reviewStartedByName;
  const onBehalf = !expense.reviewStartedOnBehalfOf
    ? ""
    : expense.reviewStartedOnBehalfOf === viewerId
      ? " on your behalf"
      : ` on behalf of ${expense.reviewStartedOnBehalfOfName ?? "another reviewer"}`;
  return `In review by ${reviewer}${onBehalf}`;
}
