import type { Expense } from "../../../types/expense";

export interface ExpenseKpis {
  totalSpending: number;
  pendingApproval: number;
  approvedExpenses: number;
  rejectedExpenses: number;
}

export function calculateExpenseKpis(
  expenses: Expense[],
): ExpenseKpis {
  return expenses.reduce<ExpenseKpis>(
    (kpis, expense) => {
      kpis.totalSpending += expense.amount;

      if (
        expense.status === "submitted" ||
        expense.status === "under_review"
      ) {
        kpis.pendingApproval += 1;
      }

      if (expense.status === "approved") {
        kpis.approvedExpenses += 1;
      }

      if (expense.status === "rejected") {
        kpis.rejectedExpenses += 1;
      }

      return kpis;
    },
    {
      totalSpending: 0,
      pendingApproval: 0,
      approvedExpenses: 0,
      rejectedExpenses: 0,
    },
  );
}