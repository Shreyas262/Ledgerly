import type {
  AnalyticsInterval,
  AnalyticsKpis,
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
  submittedAt?: string;
  reimbursement?: { processedAt?: string };
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

const DAY_MS = 86_400_000;
const toUtc = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: string, days: number) => isoDay(new Date(toUtc(date).getTime() + days * DAY_MS));
const daysBetween = (from: string, to: string) => Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);

/** Daily up to 31 days, weekly up to 90 days, monthly beyond. */
export function resolveInterval(from: string, to: string): AnalyticsInterval {
  const days = daysBetween(from, to) + 1;
  if (days <= 31) return "DAY";
  if (days <= 90) return "WEEK";
  return "MONTH";
}

function bucketOf(date: string, interval: AnalyticsInterval): string {
  if (interval === "MONTH") return date.slice(0, 7);
  if (interval === "DAY") return date.slice(0, 10);
  // Weeks start on Monday.
  const day = toUtc(date).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

function bucketsInRange(from: string, to: string, interval: AnalyticsInterval): string[] {
  const buckets: string[] = [];
  if (interval === "MONTH") {
    let year = Number(from.slice(0, 4));
    let month = Number(from.slice(5, 7));
    const end = to.slice(0, 7);
    for (;;) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      if (key > end) break;
      buckets.push(key);
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
    return buckets;
  }
  const step = interval === "DAY" ? 1 : 7;
  for (let cursor = bucketOf(from, interval); cursor <= to; cursor = addDays(cursor, step)) buckets.push(cursor);
  return buckets;
}

/** The preceding period of the same length. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const length = daysBetween(from, to) + 1;
  return { from: addDays(from, -length), to: addDays(from, -1) };
}

function matchesFilters(expense: AnalyticsExpenseRecord, query: AnalyticsQuery): boolean {
  if (!isWithinDateRange(expense.expenseDate, query)) return false;
  if (query.type && (expense.type ?? "OTHER") !== query.type) return false;
  if (query.departmentId && expense.departmentId !== query.departmentId) return false;
  if (query.teamId && expense.teamId !== query.teamId) return false;
  return true;
}

function computeKpis(reimbursed: AnalyticsExpenseRecord[]): AnalyticsKpis {
  const totalSpend = reimbursed.reduce((total, expense) => total + expense.amount, 0);
  const durations = reimbursed
    .filter((expense) => expense.submittedAt && expense.reimbursement?.processedAt)
    .map((expense) =>
      (new Date(expense.reimbursement!.processedAt!).getTime() - new Date(expense.submittedAt!).getTime()) / DAY_MS)
    .filter((days) => Number.isFinite(days) && days >= 0);
  return {
    totalSpend,
    averageExpense: reimbursed.length ? totalSpend / reimbursed.length : 0,
    largestExpense: reimbursed.reduce((largest, expense) => Math.max(largest, expense.amount), 0),
    expenseCount: reimbursed.length,
    averageDaysToReimburse: durations.length
      ? durations.reduce((total, days) => total + days, 0) / durations.length
      : null,
  };
}

const STATUS_ORDER: ExpenseStatus[] = [
  "submitted", "under_review", "approved", "reimbursement_pending", "reimbursed", "rejected", "cancelled",
];

export function buildAnalyticsSummary(
  authorizedExpenses: AnalyticsExpenseRecord[],
  rawQuery: AnalyticsQuery,
  scope: AnalyticsScope,
  names?: AnalyticsDimensionNames,
): Omit<AnalyticsSummary, "filterOptions" | "budgetComparison"> {
  const query = normalizeAnalyticsRange(rawQuery);
  const from = query.from!;
  const to = query.to!;
  // Drafts are private to their owner and never part of analytics.
  const visible = authorizedExpenses.filter((expense) => expense.status !== "draft");
  const expenses = visible.filter((expense) => matchesFilters(expense, query));
  const previous = previousRange(from, to);
  const previousExpenses = visible.filter((expense) => matchesFilters(expense, { ...query, ...previous }));

  // Spending metrics count only reimbursed (genuine, completed) expenses.
  // Workflow counts below still reflect every expense in the filtered set.
  const reimbursed = expenses.filter((expense) => expense.status === "reimbursed");
  const approvedStatuses = new Set(["approved", "reimbursement_pending", "reimbursed"]);
  const pendingStatuses = new Set(["submitted", "under_review"]);

  const interval = resolveInterval(from, to);
  const trend = new Map(bucketsInRange(from, to, interval).map((period) => [
    period, { period, amount: 0, count: 0, byType: {} as Partial<Record<ExpenseType, number>> },
  ]));
  const typeTotals = new Map<ExpenseType, { amount: number; count: number }>();
  const departmentTotals = new Map<string, number>();
  const teamTotals = new Map<string, number>();

  for (const expense of reimbursed) {
    const expenseType = expense.type ?? "OTHER";
    const point = trend.get(bucketOf(expense.expenseDate, interval));
    if (point) {
      point.amount += expense.amount;
      point.count += 1;
      point.byType[expenseType] = (point.byType[expenseType] ?? 0) + expense.amount;
    }
    const typeTotal = typeTotals.get(expenseType) ?? { amount: 0, count: 0 };
    typeTotals.set(expenseType, { amount: typeTotal.amount + expense.amount, count: typeTotal.count + 1 });
    addTotal(departmentTotals, expense.departmentId, expense.amount);
    addTotal(teamTotals, expense.teamId, expense.amount);
  }

  const approvedCount = expenses.filter((expense) => approvedStatuses.has(expense.status)).length;
  const rejectedCount = expenses.filter((expense) => expense.status === "rejected").length;
  const pendingReview = expenses.filter((expense) => pendingStatuses.has(expense.status)).length;
  const totalReviewed = approvedCount + rejectedCount;
  const hasDimensions = scope !== "TEAM";

  return {
    scope,
    filters: query,
    interval,
    kpis: computeKpis(reimbursed),
    previousKpis: computeKpis(previousExpenses.filter((expense) => expense.status === "reimbursed")),
    previousRange: previous,
    spendingTrend: Array.from(trend.values()),
    expenseTypeSpending: Array.from(typeTotals.entries())
      .map(([expenseType, total]) => ({ expenseType, ...total }))
      .sort((first, second) => second.amount - first.amount),
    // Department and team comparisons are for Finance and Admin only.
    departmentSpending: hasDimensions ? toDimensions(departmentTotals, names?.departments) : [],
    teamSpending: hasDimensions ? toDimensions(teamTotals, names?.teams) : [],
    approvalMetrics: {
      approvalRate: totalReviewed ? (approvedCount / totalReviewed) * 100 : 0,
      rejectionRate: totalReviewed ? (rejectedCount / totalReviewed) * 100 : 0,
      pendingReview,
      totalReviewed,
    },
    statusCounts: STATUS_ORDER.map((status) => ({
      status,
      count: expenses.filter((expense) => expense.status === status).length,
    })),
  };
}
