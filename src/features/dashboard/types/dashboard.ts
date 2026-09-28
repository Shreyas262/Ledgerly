import type { ExpenseType } from "../../expenses/types/expense";

export interface DashboardKpis {
  /** Sum of reimbursed expenses. */
  totalSpending: number;
  pendingApproval: number;
  approvedExpenses: number;
  rejectedExpenses: number;
}

export interface DashboardSpendingPoint {
  month: string;
  amount: number;
}

export interface DashboardExpenseTypeSpending {
  expenseType: ExpenseType;
  amount: number;
}

export interface DashboardApprovalMetrics {
  approvalRate: number;
  rejectionRate: number;
  pendingReview: number;
  totalReviewed: number;
}

export type DashboardScope = "OWN" | "TEAM" | "DEPARTMENT" | "ORGANIZATION";

export interface DashboardSummary {
  scope: DashboardScope;
  kpis: DashboardKpis;
  spendingTrend: DashboardSpendingPoint[];
  expenseTypeSpending: DashboardExpenseTypeSpending[];
  approvalMetrics: DashboardApprovalMetrics;
}
