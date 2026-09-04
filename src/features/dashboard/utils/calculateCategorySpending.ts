import type { Expense } from "../../../types/expense";

export interface CategorySpending {
  category: string;
  amount: number;
}

export function calculateCategorySpending(expenses: Expense[]): CategorySpending[] {

  const categoryTotals = new Map<string, number>();

  expenses.forEach((expense) => {
    const currentTotal =
      categoryTotals.get(expense.category) ?? 0;

    categoryTotals.set(
      expense.category,
      currentTotal + expense.amount,
    );
  });

  return Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
    }))
    .sort((first, second) => second.amount - first.amount);
}