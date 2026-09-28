import type { BudgetViewScope, OrganizationBudgetView } from "../types/budget";

export interface BudgetSummary {
  scope: BudgetViewScope;
  /** Budget available at the viewer's level (organization, departments or team). */
  totalBudget: number;
  /** Amount passed down to the next level (departments, teams or expense types). */
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  utilization: number;
  activeBudgetCount: number;
}

/**
 * Summarizes only active budgets, at the viewer's level of the hierarchy:
 * admin sees the organization, finance its departments, managers their team.
 */
export function calculateBudgetSummary(budgets: OrganizationBudgetView[]): BudgetSummary {
  const active = budgets.filter((budget) => budget.status === "active");
  const scope: BudgetViewScope = budgets[0]?.viewScope ?? "ORGANIZATION";
  let totalBudget = 0;
  let totalAllocated = 0;
  let totalSpent = 0;

  for (const budget of active) {
    if (scope === "ORGANIZATION") {
      totalBudget += budget.amount;
      totalAllocated += budget.departmentAllocations.reduce((sum, item) => sum + item.amount, 0);
      totalSpent += budget.utilization.spentAmount;
      continue;
    }
    for (const department of budget.departmentAllocations) {
      if (scope === "DEPARTMENT") {
        totalBudget += department.amount;
        totalAllocated += department.teamAllocations.reduce((sum, item) => sum + item.amount, 0);
        totalSpent += department.utilization.spentAmount;
      } else {
        for (const team of department.teamAllocations) {
          totalBudget += team.amount;
          totalAllocated += team.expenseTypeBudgets.reduce((sum, item) => sum + item.amount, 0);
          totalSpent += team.utilization.spentAmount;
        }
      }
    }
  }

  return {
    scope,
    totalBudget,
    totalAllocated,
    totalSpent,
    totalRemaining: Math.max(totalBudget - totalSpent, 0),
    utilization: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
    activeBudgetCount: active.length,
  };
}
