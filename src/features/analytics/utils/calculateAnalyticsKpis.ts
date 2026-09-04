import type { Expense } from "../../../types/expense";

export interface AnalyticsKpis {
  averageExpense: number;
  largestExpense: number;
  approvedSpend: number;
  pendingSpend: number;
}

export function calculateAnalyticsKpis(
  expenses: Expense[],
): AnalyticsKpis {
  if (expenses.length === 0) {
    return {
      averageExpense: 0,
      largestExpense: 0,
      approvedSpend: 0,
      pendingSpend: 0,
    };
  }

  const totalAmount = expenses.reduce(
    (total, expense) => total + expense.amount,
    0,
  );

  const largestExpense = Math.max(
    ...expenses.map((expense) => expense.amount),
  );

  const approvedSpend = expenses
    .filter(
      (expense) =>
        expense.status === "approved" ||
        expense.status === "reimbursement_pending" ||
        expense.status === "reimbursed",
    )
    .reduce(
      (total, expense) => total + expense.amount,
      0,
    );

  const pendingSpend = expenses
    .filter(
      (expense) =>
        expense.status === "submitted" ||
        expense.status === "under_review",
    )
    .reduce(
      (total, expense) => total + expense.amount,
      0,
    );

  return {
    averageExpense:
      totalAmount / expenses.length,
    largestExpense,
    approvedSpend,
    pendingSpend,
  };
}