import type {
  PaymentMethod,
  PersonalAnalytics,
  PersonalBudget,
  PersonalBudgetWithUsage,
  PersonalExpense,
  PersonalExpenseType,
  PersonalTypeBreakdown,
} from "../../features/personal/types/personal";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import { resolveAuthenticatedPrincipal } from "./authorizationService";
import { apiError } from "./apiError";

/**
 * Resolves the signed-in personal account. Organization accounts are refused:
 * personal and organization data never cross (§5.15).
 */
export async function authorizePersonalRequest(
  request: Request,
): Promise<{ principal: AuthenticatedPrincipal } | { error: Response }> {
  const principal = await resolveAuthenticatedPrincipal(request);
  if (!principal) return { error: apiError(401, "Please sign in to continue.") };
  if (principal.accountType !== "personal") {
    return { error: apiError(403, "Personal expense management is available to personal accounts only.") };
  }
  return { principal };
}

/** YYYY-MM of a YYYY-MM-DD calendar date. */
export const monthOf = (date: string): string => date.slice(0, 7);

/** Current calendar month in the viewer's time zone, YYYY-MM. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Today's calendar date in the viewer's time zone, YYYY-MM-DD. */
export function today(): string {
  const now = new Date();
  return `${currentMonth()}-${String(now.getDate()).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to && months.length < 120; month = shiftMonth(month, 1)) {
    months.push(month);
  }
  return months;
}

export const isMonth = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Newest first: by expense date, then by when it was recorded. */
export function byNewest(left: PersonalExpense, right: PersonalExpense): number {
  return right.expenseDate.localeCompare(left.expenseDate) || right.createdAt.localeCompare(left.createdAt);
}

const sum = (expenses: PersonalExpense[]) =>
  Math.round(expenses.reduce((total, expense) => total + expense.amount, 0) * 100) / 100;

export function breakdownByType(expenses: PersonalExpense[]): PersonalTypeBreakdown[] {
  const totals = new Map<PersonalExpenseType, PersonalTypeBreakdown>();
  for (const expense of expenses) {
    const entry = totals.get(expense.type) ?? { type: expense.type, amount: 0, count: 0 };
    entry.amount += expense.amount;
    entry.count += 1;
    totals.set(expense.type, entry);
  }
  return [...totals.values()]
    .map((entry) => ({ ...entry, amount: Math.round(entry.amount * 100) / 100 }))
    .sort((left, right) => right.amount - left.amount);
}

export function withUsage(budget: PersonalBudget, expenses: PersonalExpense[]): PersonalBudgetWithUsage {
  const monthExpenses = expenses.filter((expense) => monthOf(expense.expenseDate) === budget.month);
  const spent = sum(monthExpenses);
  return {
    ...budget,
    spent,
    remaining: Math.round((budget.amount - spent) * 100) / 100,
    utilizationPercent: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
    typeUsage: budget.typeLimits.map((limit) => ({
      ...limit,
      spent: sum(monthExpenses.filter((expense) => expense.type === limit.type)),
    })),
  };
}

export function buildAnalytics(
  expenses: PersonalExpense[],
  budgets: PersonalBudget[],
  from: string,
  to: string,
): PersonalAnalytics {
  const inRange = expenses.filter((expense) => {
    const month = monthOf(expense.expenseDate);
    return month >= from && month <= to;
  });
  const months = monthsBetween(from, to);
  const budgetByMonth = new Map(budgets.map((budget) => [budget.month, budget.amount]));
  const methods = new Map<PaymentMethod, { paymentMethod: PaymentMethod; amount: number; count: number }>();
  for (const expense of inRange) {
    const entry = methods.get(expense.paymentMethod) ?? { paymentMethod: expense.paymentMethod, amount: 0, count: 0 };
    entry.amount += expense.amount;
    entry.count += 1;
    methods.set(expense.paymentMethod, entry);
  }
  const total = sum(inRange);

  return {
    from,
    to,
    total,
    count: inRange.length,
    averagePerMonth: months.length ? Math.round((total / months.length) * 100) / 100 : 0,
    largestExpense: inRange.reduce<PersonalExpense | null>(
      (largest, expense) => (!largest || expense.amount > largest.amount ? expense : largest),
      null,
    ),
    monthly: months.map((month) => ({
      month,
      amount: sum(inRange.filter((expense) => monthOf(expense.expenseDate) === month)),
      budget: budgetByMonth.get(month) ?? null,
    })),
    byType: breakdownByType(inRange),
    byPaymentMethod: [...methods.values()].sort((left, right) => right.amount - left.amount),
  };
}
