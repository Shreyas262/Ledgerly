import type { Expense } from "../../../types/expense";

export interface DashboardDateRange {
  startDate: string;
  endDate: string;
}

export function filterExpensesByDate(
  expenses: Expense[],
  dateRange: DashboardDateRange,
): Expense[] {

  const { startDate, endDate } = dateRange;

  if (startDate && endDate && startDate > endDate) {
    return [];
  }

  if (!startDate && !endDate) {
    return expenses;
  }

  return expenses.filter((expense) => {
    if (
      startDate &&
      expense.expenseDate < startDate
    ) {
      return false;
    }

    if (
      endDate &&
      expense.expenseDate > endDate
    ) {
      return false;
    }

    return true;
  });
}