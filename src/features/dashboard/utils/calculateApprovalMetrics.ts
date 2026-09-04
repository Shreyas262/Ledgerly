import type { Expense } from "../../../types/expense";

export interface ApprovalMetrics {
  approvalRate: number;
  rejectionRate: number;
  pendingReview: number;
  totalReviewed: number;
}

export function calculateApprovalMetrics(
  expenses: Expense[],
): ApprovalMetrics {
  const approvedExpenses = expenses.filter(
    (expense) => expense.status === "approved",
  ).length;

  const rejectedExpenses = expenses.filter(
    (expense) => expense.status === "rejected",
  ).length;

  const pendingReview = expenses.filter(
    (expense) => expense.status === "submitted" ||
      expense.status === "under_review",
  ).length;

  const totalReviewed =
    approvedExpenses + rejectedExpenses;

  const approvalRate =
    totalReviewed > 0
      ? (approvedExpenses / totalReviewed) * 100
      : 0;

  const rejectionRate =
    totalReviewed > 0
      ? (rejectedExpenses / totalReviewed) * 100
      : 0;

  return {
    approvalRate,
    rejectionRate,
    pendingReview,
    totalReviewed,
  };
}