import type { BudgetForecastStatus } from "../../budgets/types/budget";
import type { CurrencyConversion } from "../../currency/types/currency";
import type { ExpenseStatus, ExpenseType } from "../../expenses/types/expense";

export interface DashboardKpis {
  /** Sum of reimbursed expenses. */
  totalSpending: number;
  pendingApproval: number;
  approvedExpenses: number;
  rejectedExpenses: number;
  /** Rupee totals of the counts above. */
  pendingAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
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

/** The user's own expenses that need them to act, whatever the date range. */
export interface DashboardAttention {
  drafts: number;
  /** Drafts that cannot be submitted until a receipt is attached. */
  draftsWithoutReceipt: number;
  /** Rejected expenses the user can restore to a draft and revise. */
  rejected: number;
  /** Why the user cannot create expenses right now, if they cannot. */
  creationBlockedReason: string | null;
}

/** Approved expenses not yet paid to the user, whatever the date range. */
export interface DashboardOwed {
  amount: number;
  count: number;
}

export interface DashboardRecentExpense {
  id: string;
  title: string;
  type: ExpenseType;
  amount: number;
  conversion?: CurrencyConversion;
  status: ExpenseStatus;
  expenseDate: string;
}

export interface DashboardBudgetAlert {
  budgetId: string;
  /** The budget, department or team allocation, as the viewer sees it. */
  name: string;
  utilizationPercent: number;
  /** Present when the level is projected to exceed its allocation or already over-committed (§28.19). */
  forecast?: {
    status: Exclude<BudgetForecastStatus, "ON_TRACK">;
    overBy: number;
    runsOutOn: string | null;
  };
}

/** Work waiting on the user in their role; null where the role has no such queue. */
export interface DashboardWorkQueues {
  approvals: { count: number; oldestWaitingDays: number | null } | null;
  reimbursements: { count: number; amount: number } | null;
  /** Active budgets at the viewer's level that are 80% or more used, projected to exceed or over-committed. */
  budgetAlerts: DashboardBudgetAlert[] | null;
}

export type DashboardScope = "OWN" | "TEAM" | "DEPARTMENT" | "ORGANIZATION";

export interface DashboardSummary {
  scope: DashboardScope;
  kpis: DashboardKpis;
  spendingTrend: DashboardSpendingPoint[];
  expenseTypeSpending: DashboardExpenseTypeSpending[];
  approvalMetrics: DashboardApprovalMetrics;
  attention: DashboardAttention;
  owed: DashboardOwed;
  recent: DashboardRecentExpense[];
  workQueues: DashboardWorkQueues;
}
