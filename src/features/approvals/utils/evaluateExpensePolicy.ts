import type { Expense } from "../../../types/expense";
import type { ExpensePolicy } from "../../../types/policy";

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
  policy?: ExpensePolicy | ExpensePolicyConfig,
): ExpensePolicyResult {
  const config =
    policy ?? DEFAULT_POLICY_CONFIG;

  if (expense.amount > config.approvalLimit) {
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