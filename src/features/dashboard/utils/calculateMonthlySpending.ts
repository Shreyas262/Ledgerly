import type { Expense } from "../../../types/expense";

export interface MonthlySpending {
  month: string;
  amount: number;
}

export function calculateMonthlySpending(
  expenses: Expense[],
): MonthlySpending[] {
  const monthlyTotals = new Map<string, number>();

  expenses.forEach((expense) => {
    const date = new Date(expense.expenseDate);

    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, "0")}`;

    const currentTotal = monthlyTotals.get(monthKey) ?? 0;

    monthlyTotals.set(
      monthKey,
      currentTotal + expense.amount,
    );
  });

  return Array.from(monthlyTotals.entries())
    .sort(([firstMonth], [secondMonth]) =>
      firstMonth.localeCompare(secondMonth),
    )
    .map(([monthKey, amount]) => {
      const [year, month] = monthKey.split("-");

      const date = new Date(
        Number(year),
        Number(month) - 1,
      );

      return {
        month: date.toLocaleDateString("en-IN", {
          month: "short",
          year: "numeric",
        }),
        amount,
      };
    });
}