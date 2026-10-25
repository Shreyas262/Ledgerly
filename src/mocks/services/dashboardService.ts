import { formatDate } from "../../utils/format";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type {
  DashboardBudgetAlert,
  DashboardSummary,
  DashboardWorkQueues,
} from "../../features/dashboard/types/dashboard";
import type { Expense, ExpenseType } from "../../features/expenses/types/expense";
import { getApprovalQueue } from "./approvalService";
import { getReimbursementQueue } from "./reimbursementService";
import {
  getExpenseCreationEligibility,
  listViewerBudgetLevels,
  resolveBudgetScope,
} from "./budgetService";

export type DashboardExpenseRecord = Pick<
  Expense,
  "id" | "title" | "amount" | "conversion" | "status" | "expenseDate" | "documentIds" | "createdAt"
> & { type?: ExpenseType };

/** Budgets at or above this share used are flagged, matching the amber band on budget cards. */
export const BUDGET_ALERT_PERCENT = 80;
const RECENT_COUNT = 5;
const DAY_MS = 86_400_000;

/** What only the handler can resolve for the principal: creation eligibility and role queues. */
export interface DashboardContext {
  creationBlockedReason: string | null;
  workQueues: DashboardWorkQueues;
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
  context: DashboardContext,
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

  const pending = expenses.filter(
    (expense) =>
      expense.status === "submitted" ||
      expense.status === "under_review",
  );
  const pendingApproval = pending.length;

  // Approved includes expenses that have moved on to reimbursement, matching
  // the analytics definition of approved spend.
  const approved = expenses.filter((expense) =>
    APPROVED_STATUSES.has(expense.status),
  );
  const approvedExpenses = approved.length;

  const rejected = expenses.filter(
    (expense) => expense.status === "rejected",
  );
  const rejectedExpenses = rejected.length;

  // Attention, money owed and recent activity describe the present, so they
  // ignore the date range.
  const drafts = authorizedExpenses.filter((expense) => expense.status === "draft");
  const owed = authorizedExpenses.filter(
    (expense) => expense.status === "approved" || expense.status === "reimbursement_pending",
  );
  const recent = [...authorizedExpenses]
    .sort((first, second) =>
      second.expenseDate.localeCompare(first.expenseDate) ||
      String(second.createdAt ?? "").localeCompare(String(first.createdAt ?? "")))
    .slice(0, RECENT_COUNT);

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
      pendingAmount: sumAmounts(pending),
      approvedAmount: sumAmounts(approved),
      rejectedAmount: sumAmounts(rejected),
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
    attention: {
      drafts: drafts.length,
      draftsWithoutReceipt: drafts.filter((expense) => !expense.documentIds?.length).length,
      rejected: authorizedExpenses.filter((expense) => expense.status === "rejected").length,
      creationBlockedReason: context.creationBlockedReason,
    },
    owed: { amount: sumAmounts(owed), count: owed.length },
    recent: recent.map(({ id, title, type, amount, conversion, status, expenseDate }) => ({
      id,
      title,
      type: type ?? "OTHER",
      amount,
      ...(conversion ? { conversion } : {}),
      status,
      expenseDate,
    })),
    workQueues: context.workQueues,
  };
}

function sumAmounts(expenses: DashboardExpenseRecord[]): number {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

/** Why the principal cannot create expenses now (§28.16), or null when they can or may not create at all. */
export async function getCreationBlockedReason(principal: AuthenticatedPrincipal): Promise<string | null> {
  if (!principal.effectivePermissions.includes("expenses.create")) return null;
  const eligibility = await getExpenseCreationEligibility(principal);
  return eligibility.allowed ? null : eligibility.reason ?? null;
}

/**
 * The principal's own work queues (§25.1): approvals waiting on them, expenses
 * ready to reimburse and budgets near their limit, each only for roles that
 * hold that responsibility. Counts come from the same authorized queues as the
 * Approvals, Reimbursements and Budgets pages.
 */
export async function buildDashboardWorkQueues(
  principal: AuthenticatedPrincipal,
  now: Date = new Date(),
): Promise<DashboardWorkQueues> {
  const permissions = principal.effectivePermissions;
  const reviews = ["manager", "finance", "admin"].includes(principal.role) && permissions.includes("expenses.approve");
  const reimburses = (principal.role === "finance" || principal.role === "admin") && permissions.includes("reimbursements.manage");
  const readsBudgets = resolveBudgetScope(principal) !== null && permissions.includes("budgets.read");

  const [approvalQueue, financialWork, budgetAlerts] = await Promise.all([
    reviews ? getApprovalQueue(principal) : null,
    reimburses ? getReimbursementQueue(principal) : null,
    readsBudgets ? getBudgetAlerts(principal) : null,
  ]);
  // The reimbursement queue also lists its history; only unpaid expenses are waiting.
  const reimbursementQueue = financialWork?.filter(
    (expense) => expense.status === "approved" || expense.status === "reimbursement_pending",
  ) ?? null;

  const oldestSubmittedAt = approvalQueue
    ?.map((expense) => expense.submittedAt ?? expense.updatedAt)
    .filter((date): date is string => Boolean(date))
    .sort()[0];

  return {
    approvals: approvalQueue
      ? {
          count: approvalQueue.length,
          oldestWaitingDays: oldestSubmittedAt
            ? Math.max(0, Math.floor((now.getTime() - new Date(oldestSubmittedAt).getTime()) / DAY_MS))
            : null,
        }
      : null,
    reimbursements: reimbursementQueue
      ? { count: reimbursementQueue.length, amount: reimbursementQueue.reduce((total, expense) => total + expense.amount, 0) }
      : null,
    budgetAlerts,
  };
}

/** Over-committed first, then projected to exceed, then by share used. */
const ALERT_ORDER = { OVER_COMMITTED: 0, PROJECTED_OVER: 1, NONE: 2 } as const;

/**
 * Active budgets at the principal's level (§28.5) that are at least
 * BUDGET_ALERT_PERCENT used, projected to exceed their allocation or already
 * over-committed (§28.19).
 */
async function getBudgetAlerts(principal: AuthenticatedPrincipal): Promise<DashboardBudgetAlert[]> {
  const alerts: DashboardBudgetAlert[] = [];
  for (const level of await listViewerBudgetLevels(principal)) {
    const forecast = level.forecast && level.forecast.status !== "ON_TRACK" ? level.forecast : null;
    if (!forecast && level.utilizationPercent < BUDGET_ALERT_PERCENT) continue;
    alerts.push({
      budgetId: level.budgetId,
      name: level.name,
      utilizationPercent: level.utilizationPercent,
      ...(forecast
        ? { forecast: { status: forecast.status as "PROJECTED_OVER" | "OVER_COMMITTED", overBy: forecast.overBy, runsOutOn: forecast.runsOutOn } }
        : {}),
    });
  }
  const rank = (alert: DashboardBudgetAlert) => ALERT_ORDER[alert.forecast?.status ?? "NONE"];
  return alerts.sort((first, second) => rank(first) - rank(second) || second.utilizationPercent - first.utilizationPercent);
}
