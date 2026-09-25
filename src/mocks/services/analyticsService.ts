import type {
  AnalyticsQuery,
  AnalyticsScope,
  AnalyticsSummary,
} from "../../features/analytics/types/analytics";
import type { ExpenseStatus, ExpenseType } from "../../features/expenses/types/expense";

export interface AnalyticsExpenseRecord {
  amount: number;
  type?: ExpenseType;
  status: ExpenseStatus | string;
  expenseDate: string;
  departmentId?: string;
  teamId?: string;
  projectId?: string;
}

const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 365;

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function dateOnlyDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeAnalyticsRange(query: AnalyticsQuery): AnalyticsQuery {
  return {
    ...query,
    from: query.from ?? dateOnlyDaysAgo(DEFAULT_RANGE_DAYS),
    to: query.to ?? today(),
  };
}

export function validateAnalyticsQuery(query: AnalyticsQuery): string | null {
  if (query.from && !isValidDate(query.from)) {
    return "The analytics start date is invalid.";
  }

  if (query.to && !isValidDate(query.to)) {
    return "The analytics end date is invalid.";
  }

  if (query.from && query.to && query.from > query.to) {
    return "The analytics start date must be before or equal to the end date.";
  }

  if (query.from && query.to) {
    const from = new Date(`${query.from}T00:00:00.000Z`).getTime();
    const to = new Date(`${query.to}T23:59:59.999Z`).getTime();
    const days = (to - from) / 86_400_000;
    if (days > MAX_RANGE_DAYS) {
      return `Analytics date ranges cannot exceed ${MAX_RANGE_DAYS} days.`;
    }
  }

  return null;
}

function isWithinDateRange(
  expenseDate: string,
  query: AnalyticsQuery,
): boolean {
  const timestamp = new Date(expenseDate).getTime();
  if (!Number.isFinite(timestamp)) return false;

  if (query.from) {
    const from = new Date(`${query.from}T00:00:00.000Z`).getTime();
    if (timestamp < from) return false;
  }

  if (query.to) {
    const to = new Date(`${query.to}T23:59:59.999Z`).getTime();
    if (timestamp > to) return false;
  }

  return true;
}

function addTotal(map: Map<string, number>, key: string | undefined, amount: number) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

export interface AnalyticsDimensionNames {
  departments: Map<string, string>;
  teams: Map<string, string>;
}

function toDimensions(map: Map<string, number>, names?: Map<string, string>) {
  return Array.from(map.entries())
    .map(([dimensionId, amount]) => ({
      dimensionId,
      dimensionName: names?.get(dimensionId) ?? dimensionId,
      amount,
    }))
    .sort((first, second) => second.amount - first.amount);
}

export function buildAnalyticsSummary(
  authorizedExpenses: AnalyticsExpenseRecord[],
  rawQuery: AnalyticsQuery,
  scope: AnalyticsScope,
  names?: AnalyticsDimensionNames,
): AnalyticsSummary {
  const query = normalizeAnalyticsRange(rawQuery);
  const expenses = authorizedExpenses.filter((expense) => {
    if (!isWithinDateRange(expense.expenseDate, query)) return false;
    if (query.type && (expense.type ?? "OTHER") !== query.type) return false;
    if (query.status && expense.status !== query.status) return false;
    if (query.departmentId && expense.departmentId !== query.departmentId) return false;
    if (query.teamId && expense.teamId !== query.teamId) return false;
    return true;
  });

  const totalSpend = expenses.reduce((total, expense) => total + expense.amount, 0);
  const approvedStatuses = new Set(["approved", "reimbursement_pending", "reimbursed"]);
  const pendingStatuses = new Set(["submitted", "under_review"]);
  const approvedSpend = expenses
    .filter((expense) => approvedStatuses.has(expense.status))
    .reduce((total, expense) => total + expense.amount, 0);
  const pendingSpend = expenses
    .filter((expense) => pendingStatuses.has(expense.status))
    .reduce((total, expense) => total + expense.amount, 0);

  const monthlyTotals = new Map<string, number>();
  const typeTotals = new Map<ExpenseType, number>();
  const departmentTotals = new Map<string, number>();
  const teamTotals = new Map<string, number>();
  const projectTotals = new Map<string, number>();

  for (const expense of expenses) {
    const date = new Date(expense.expenseDate);
    const period = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    addTotal(monthlyTotals, period, expense.amount);
    const expenseType = expense.type ?? "OTHER";
    typeTotals.set(expenseType, (typeTotals.get(expenseType) ?? 0) + expense.amount);
    addTotal(departmentTotals, expense.departmentId, expense.amount);
    addTotal(teamTotals, expense.teamId, expense.amount);
    addTotal(projectTotals, expense.projectId, expense.amount);
  }

  const approvedCount = expenses.filter((expense) => approvedStatuses.has(expense.status)).length;
  const rejectedCount = expenses.filter((expense) => expense.status === "rejected").length;
  const pendingReview = expenses.filter((expense) => pendingStatuses.has(expense.status)).length;
  const totalReviewed = approvedCount + rejectedCount;

  return {
    scope,
    filters: query,
    kpis: {
      totalSpend,
      averageExpense: expenses.length ? totalSpend / expenses.length : 0,
      largestExpense: expenses.length ? Math.max(...expenses.map((expense) => expense.amount)) : 0,
      approvedSpend,
      pendingSpend,
      expenseCount: expenses.length,
    },
    spendingTrend: Array.from(monthlyTotals.entries())
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([period, amount]) => ({ period, amount })),
    expenseTypeSpending: Array.from(typeTotals.entries())
      .map(([expenseType, amount]) => ({ expenseType, amount }))
      .sort((first, second) => second.amount - first.amount),
    departmentSpending: toDimensions(departmentTotals, names?.departments),
    teamSpending: toDimensions(teamTotals, names?.teams),
    projectSpending: toDimensions(projectTotals),
    approvalMetrics: {
      approvalRate: totalReviewed ? (approvedCount / totalReviewed) * 100 : 0,
      rejectionRate: totalReviewed ? (rejectedCount / totalReviewed) * 100 : 0,
      pendingReview,
      totalReviewed,
    },
  };
}
