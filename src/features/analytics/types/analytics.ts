import type { ExpenseStatus, ExpenseType } from "../../expenses/types/expense";
import type { PolicyFindingRule } from "../../policies/types/policy";

export type AnalyticsScope = "TEAM" | "DEPARTMENT" | "ORGANIZATION";

export interface AnalyticsQuery {
  from?: string;
  to?: string;
  type?: ExpenseType;
  departmentId?: string;
  teamId?: string;
}

export interface AnalyticsKpis {
  totalSpend: number;
  averageExpense: number;
  largestExpense: number;
  /** Number of reimbursed expenses in the filtered range. */
  expenseCount: number;
  /** Average days from submission to reimbursement; null without data. */
  averageDaysToReimburse: number | null;
}

/** Trend bucket size, chosen from the length of the date range. */
export type AnalyticsInterval = "DAY" | "WEEK" | "MONTH";

export interface AnalyticsSpendingPoint {
  /** Bucket start: YYYY-MM-DD for DAY/WEEK, YYYY-MM for MONTH. */
  period: string;
  amount: number;
  count: number;
  byType: Partial<Record<ExpenseType, number>>;
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

export interface AnalyticsFilterOptions {
  departments: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string; departmentId: string }>;
}

/** Allocation against reimbursed spend in the active budget (§26.5). */
export interface AnalyticsBudgetComparison {
  budgetName: string;
  startDate: string;
  endDate: string;
  level: "DEPARTMENT" | "TEAM" | "EXPENSE_TYPE";
  rows: Array<{ id: string; name: string; allocated: number; spent: number }>;
}

/** Policy outcomes for expenses in the view (§26.8). */
export interface AnalyticsPolicyCompliance {
  /** Submitted expenses checked against a policy. */
  checked: number;
  /** Submitted above a policy approval threshold. */
  escalated: number;
  /** Submitted with at least one policy warning. */
  withWarnings: number;
  /** Submission attempts blocked by policy. */
  blockedAttempts: number;
  byRule: Array<{ rule: PolicyFindingRule; warnings: number; blocked: number }>;
  /** Blocked attempts per department; empty for the team scope. */
  blockedByDepartment: Array<{ dimensionId: string; dimensionName: string; count: number }>;
}

export interface AnalyticsSummary {
  scope: AnalyticsScope;
  filters: AnalyticsQuery;
  interval: AnalyticsInterval;
  kpis: AnalyticsKpis;
  /** The same KPIs for the preceding period of equal length. */
  previousKpis: AnalyticsKpis;
  previousRange: { from: string; to: string };
  spendingTrend: AnalyticsSpendingPoint[];
  expenseTypeSpending: Array<{ expenseType: ExpenseType; amount: number; count: number }>;
  /** Empty for the TEAM scope: managers see no department or team comparison. */
  departmentSpending: AnalyticsDimensionSpending[];
  teamSpending: AnalyticsDimensionSpending[];
  approvalMetrics: AnalyticsApprovalMetrics;
  statusCounts: Array<{ status: ExpenseStatus; count: number }>;
  filterOptions: AnalyticsFilterOptions;
  budgetComparison: AnalyticsBudgetComparison | null;
  policyCompliance: AnalyticsPolicyCompliance;
}
