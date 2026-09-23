import type { EntityId } from "../../../types/common";

export interface DashboardKpis {
  totalSpend: number;
  pendingApproval: number;
  approvedAmount: number;
  reimbursedAmount: number;
  budgetUtilization: number;
}

export interface DashboardSpendingPoint {
  period: string;
  amount: number;
}

export interface DashboardCategorySpending {
  category: string;
  amount: number;
}

export interface DashboardDimensionSpending {
  dimensionId: EntityId | string;
  dimensionName: string;
  amount: number;
}

export interface DashboardApprovalMetrics {
  pending: number;
  approved: number;
  rejected: number;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  spendingTrend: DashboardSpendingPoint[];
  categorySpending: DashboardCategorySpending[];
  dimensionSpending: DashboardDimensionSpending[];
  approvalMetrics: DashboardApprovalMetrics;
}