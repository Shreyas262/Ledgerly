import { formatDate } from "../../utils/format";
import type { DashboardSummary } from "../../features/dashboard/types/dashboard";
import type { ExpenseStatus, ExpenseType } from "../../features/expenses/types/expense";

export interface DashboardExpenseRecord {
  amount: number;
  type?: ExpenseType;
  status: ExpenseStatus | string;
  expenseDate: string;
}

const APPROVED_STATUSES = new Set<string>([
  "approved",
  "reimbursement_pending",
  "reimbursed",
]);

export interface DashboardDateRange {
  from?: string;
  to?: string;
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function isWithinDateRange(
  expenseDate: string,
  range: DashboardDateRange,
): boolean {
  const timestamp = new Date(expenseDate).getTime();

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  if (range.from) {
    const from = new Date(`${range.from}T00:00:00.000Z`).getTime();
    if (timestamp < from) {
      return false;
    }
  }

  if (range.to) {
    const to = new Date(`${range.to}T23:59:59.999Z`).getTime();
    if (timestamp > to) {
      return false;
    }
  }

  return true;
}

export function validateDashboardDateRange(
  range: DashboardDateRange,
): string | null {
  if (range.from && !isValidDate(`${range.from}T00:00:00.000Z`)) {
    return "The dashboard start date is invalid.";
  }

  if (range.to && !isValidDate(`${range.to}T00:00:00.000Z`)) {
    return "The dashboard end date is invalid.";
  }

  if (range.from && range.to && range.from > range.to) {
    return "The dashboard start date must be before or equal to the end date.";
  }

  return null;
}

export function buildDashboardSummary(
  authorizedExpenses: DashboardExpenseRecord[],
  range: DashboardDateRange,
  scope: DashboardSummary["scope"],
): DashboardSummary {
  const expenses = authorizedExpenses.filter((expense) =>
    isWithinDateRange(expense.expenseDate, range),
  );

  // Spending counts only reimbursed (genuine, completed) expenses; workflow
  // counts below still reflect every expense in the range.
  const reimbursed = expenses.filter((expense) => expense.status === "reimbursed");
  const totalSpending = reimbursed.reduce(
    (total, expense) => total + expense.amount,
    0,
  );

  const pendingApproval = expenses.filter(
    (expense) =>
      expense.status === "submitted" ||
      expense.status === "under_review",
  ).length;

  // Approved includes expenses that have moved on to reimbursement, matching
  // the analytics definition of approved spend.
  const approvedExpenses = expenses.filter((expense) =>
    APPROVED_STATUSES.has(expense.status),
  ).length;

  const rejectedExpenses = expenses.filter(
    (expense) => expense.status === "rejected",
  ).length;


  const monthlyTotals = new Map<string, number>();
  const typeTotals = new Map<ExpenseType, number>();

  for (const expense of reimbursed) {
    const date = new Date(expense.expenseDate);
    const monthKey = `${date.getUTCFullYear()}-${String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0")}`;

    monthlyTotals.set(
      monthKey,
      (monthlyTotals.get(monthKey) ?? 0) + expense.amount,
    );

    const expenseType = expense.type ?? "OTHER";
    typeTotals.set(
      expenseType,
      (typeTotals.get(expenseType) ?? 0) + expense.amount,
    );
  }

  const approvedReviewed = approvedExpenses;
  const rejectedReviewed = rejectedExpenses;
  const totalReviewed = approvedReviewed + rejectedReviewed;

  return {
    scope,
    kpis: {
      totalSpending,
      pendingApproval,
      approvedExpenses,
      rejectedExpenses,
    },
    spendingTrend: Array.from(monthlyTotals.entries())
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([monthKey, amount]) => {
        // Same month names as every other date in the app ("Sep 2026").
        return {
          month: formatDate(`${monthKey}-01`).replace(/^\d+ /, ""),
          amount,
        };
      }),
    expenseTypeSpending: Array.from(typeTotals.entries())
      .map(([expenseType, amount]) => ({ expenseType, amount }))
      .sort((first, second) => second.amount - first.amount),
    approvalMetrics: {
      approvalRate:
        totalReviewed > 0
          ? (approvedReviewed / totalReviewed) * 100
          : 0,
      rejectionRate:
        totalReviewed > 0
          ? (rejectedReviewed / totalReviewed) * 100
          : 0,
      pendingReview: pendingApproval,
      totalReviewed,
    },
  };
}
