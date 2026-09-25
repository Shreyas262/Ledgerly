import type { ExpenseType } from "../../expenses/types/expense";

export type AnalyticsScope = "TEAM" | "DEPARTMENT" | "ORGANIZATION";

export interface AnalyticsQuery {
  from?: string;
  to?: string;
  type?: ExpenseType;
  status?: string;
  departmentId?: string;
  teamId?: string;
}

export interface AnalyticsKpis {
  totalSpend: number;
  averageExpense: number;
  largestExpense: number;
  approvedSpend: number;
  pendingSpend: number;
  expenseCount: number;
}

export interface AnalyticsSpendingPoint {
  period: string;
  amount: number;
}

export interface AnalyticsDimensionSpending {
  dimensionId: string;
  dimensionName: string;
  amount: number;
}

export interface AnalyticsApprovalMetrics {
  approvalRate: number;
  rejectionRate: number;
  pendingReview: number;
  totalReviewed: number;
}

export interface AnalyticsSummary {
  scope: AnalyticsScope;
  filters: AnalyticsQuery;
  kpis: AnalyticsKpis;
  spendingTrend: AnalyticsSpendingPoint[];
  expenseTypeSpending: Array<{ expenseType: ExpenseType; amount: number }>;
  departmentSpending: AnalyticsDimensionSpending[];
  teamSpending: AnalyticsDimensionSpending[];
  projectSpending: AnalyticsDimensionSpending[];
  approvalMetrics: AnalyticsApprovalMetrics;
}
