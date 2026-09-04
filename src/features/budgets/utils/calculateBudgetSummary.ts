import type { Budget } from "../../../types/budget";

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  utilization: number;
}

export function calculateBudgetSummary(
  budgets: Budget[],
): BudgetSummary {
  const totalBudget = budgets.reduce(
    (total, budget) => total + budget.amount,
    0,
  );

  const totalSpent = budgets.reduce(
    (total, budget) => total + budget.spentAmount,
    0,
  );

  const totalRemaining = Math.max(
    totalBudget - totalSpent,
    0,
  );

  const utilization =
    totalBudget > 0
      ? (totalSpent / totalBudget) * 100
      : 0;

  return {
    totalBudget,
    totalSpent,
    totalRemaining,
    utilization,
  };
}