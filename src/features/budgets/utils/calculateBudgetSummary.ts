import type { OrganizationBudgetView } from "../types/budget";

export interface BudgetSummary {
  totalBudget: number;
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  utilization: number;
}

export function calculateBudgetSummary(
  budgets: OrganizationBudgetView[],
): BudgetSummary {
  const totalBudget = budgets.reduce((total, budget) => total + budget.amount, 0);
  const totalAllocated = budgets.reduce(
    (total, budget) =>
      total + budget.departmentAllocations.reduce((sum, item) => sum + item.amount, 0),
    0,
  );
  const totalSpent = budgets.reduce(
    (total, budget) => total + budget.utilization.spentAmount,
    0,
  );
  const totalRemaining = Math.max(totalBudget - totalSpent, 0);

  return {
    totalBudget,
    totalAllocated,
    totalSpent,
    totalRemaining,
    utilization: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
  };
}
