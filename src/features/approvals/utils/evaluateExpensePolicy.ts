import type { Expense } from "../../../types/expense";

export interface ExpensePolicyConfig {
  approvalLimit: number;
}

export type ExpensePolicyResult =
  | {
      allowed: true;
      reason: null;
    }
  | {
      allowed: false;
      reason: string;
    };

const DEFAULT_POLICY_CONFIG: ExpensePolicyConfig = {
  approvalLimit: 50000,
};

export function evaluateExpensePolicy(
  expense: Expense,
  config: ExpensePolicyConfig = DEFAULT_POLICY_CONFIG,
): ExpensePolicyResult {
  const amount = Number(expense.amount);

  if (amount > config.approvalLimit) {
    return {
      allowed: false,
      reason: `Expenses above ₹${config.approvalLimit.toLocaleString(
        "en-IN",
      )} require additional approval.`,
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}