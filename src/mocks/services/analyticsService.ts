import type {
  AnalyticsInterval,
  AnalyticsKpis,
  AnalyticsPolicyCompliance,
  AnalyticsQuery,
  AnalyticsScope,
  AnalyticsSummary,
} from "../../features/analytics/types/analytics";
import type { ExpenseStatus, ExpenseType } from "../../features/expenses/types/expense";
import type { PolicyEvaluation, PolicyFindingRule } from "../../features/policies/types/policy";

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
  id?: string;
  policyEvaluation?: PolicyEvaluation;
}

/** A stored policy check, used to count blocked submission attempts. */
export interface AnalyticsPolicySnapshot {
  expenseId: string;
  result: string;
  details?: PolicyEvaluation["details"];
  /** Minimal fields of the (possibly draft) expense, resolved within the viewer's scope. */
  expense: Pick<AnalyticsExpenseRecord, "amount" | "type" | "status" | "expenseDate" | "departmentId" | "teamId">;
}

const BLOCKED_RESULTS = new Set(["VIOLATES_POLICY", "MISSING_INFORMATION"]);

/**
 * §26.8: policy outcomes. Warnings and escalation come from submitted
 * expenses; blocked attempts from stored checks whose submission was refused
 * (counted in aggregate only — draft contents are never exposed).
 */
function buildPolicyCompliance(
  submitted: AnalyticsExpenseRecord[],
  query: AnalyticsQuery,
  snapshots: AnalyticsPolicySnapshot[],
  names: Map<string, string> | undefined,
  hasDimensions: boolean,
): AnalyticsPolicyCompliance {
  const byRule = new Map<PolicyFindingRule, { warnings: number; blocked: number }>();
  const bump = (rule: PolicyFindingRule, key: "warnings" | "blocked") => {
    const entry = byRule.get(rule) ?? { warnings: 0, blocked: 0 };
    entry[key] += 1;
    byRule.set(rule, entry);
  };
  const checked = submitted.filter((expense) => expense.policyEvaluation?.policyId);
  for (const expense of submitted) {
    for (const finding of expense.policyEvaluation?.details.findings ?? []) {
      if (finding.enforcement === "WARN") bump(finding.rule, "warnings");
    }
  }
  const blocked = snapshots.filter((snapshot) => BLOCKED_RESULTS.has(snapshot.result) && matchesFilters(snapshot.expense, query));
  const blockedByDepartment = new Map<string, number>();
  for (const snapshot of blocked) {
    const findings = snapshot.details?.findings;
    if (findings?.length) {
      for (const finding of findings) if (finding.enforcement === "BLOCK") bump(finding.rule, "blocked");
    } else if (snapshot.details?.missingInformation?.length) {
      bump("receipt", "blocked");
    }
    addTotal(blockedByDepartment, snapshot.expense.departmentId, 1);
  }
  return {
    checked: checked.length,
    escalated: submitted.filter((expense) => expense.policyEvaluation?.details.escalated).length,
    withWarnings: submitted.filter((expense) => expense.policyEvaluation?.details.warnings?.length).length,
    blockedAttempts: blocked.length,
    byRule: Array.from(byRule.entries())
      .map(([rule, counts]) => ({ rule, ...counts }))
      .sort((first, second) => second.warnings + second.blocked - (first.warnings + first.blocked)),
    blockedByDepartment: hasDimensions
      ? Array.from(blockedByDepartment.entries())
          .map(([dimensionId, count]) => ({ dimensionId, dimensionName: names?.get(dimensionId) ?? dimensionId, count }))
          .sort((first, second) => second.count - first.count)
      : [],
  };
}

const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 365;

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

// Default ranges use the local calendar date, matching how expense dates are entered.
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function dateOnlyDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDate(date);
}

function today(): string {
  return localDate(new Date());
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
  policySnapshots: AnalyticsPolicySnapshot[] = [],
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
    policyCompliance: buildPolicyCompliance(
      expenses.filter((expense) => expense.status !== "cancelled"),
      query,
      policySnapshots,
      names?.departments,
      hasDimensions,
    ),
  };
}
