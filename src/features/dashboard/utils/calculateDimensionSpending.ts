import type { Expense } from "../../../types/expense";

export interface DimensionSpending {
  name: string;
  amount: number;
}

export function calculateDimensionSpending(
  expenses: Expense[],
  getDimension: (expense: Expense) => string | undefined,
): DimensionSpending[] {
  const totals = new Map<string, number>();

  expenses.forEach((expense) => {
    const dimension = getDimension(expense);

    if (!dimension) {
      return;
    }

    const currentTotal = totals.get(dimension) ?? 0;

    totals.set(
      dimension,
      currentTotal + expense.amount,
    );
  });

  return Array.from(totals.entries())
    .map(([name, amount]) => ({
      name,
      amount,
    }))
    .sort(
      (first, second) => second.amount - first.amount,
    );
}