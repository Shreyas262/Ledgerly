import type { Budget, BudgetStatus } from "../../../types/budget";

export function calculateBudgetRemaining(
  budget: Budget,
): number {
  return Math.max(
    budget.amount - budget.spentAmount,
    0,
  );
}

export function calculateBudgetUtilization(
  budget: Budget,
): number {
  if (budget.amount <= 0) {
    return 0;
  }

  return Math.min(
    (budget.spentAmount / budget.amount) * 100,
    100,
  );
}

export function calculateBudgetStatus(
  budget: Budget,
  currentDate = new Date(),
): BudgetStatus {
  const today = currentDate
    .toISOString()
    .slice(0, 10);

  if (today > budget.endDate) {
    return "expired";
  }

  if (budget.spentAmount >= budget.amount) {
    return "exhausted";
  }

  return "active";
}