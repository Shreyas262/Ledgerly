import type { EntityId } from "../../../types/common";

export interface AnalyticsKpis {
  totalSpend: number;
  pendingApproval: number;
  approvedThisMonth: number;
  reimbursed: number;
  policyViolations: number;
  budgetUtilization: number;
}

export interface SpendingPoint {
  period: string;
  amount: number;
}

export interface DimensionSpending {
  dimensionId: EntityId | string;
  dimensionName: string;
  amount: number;
}
