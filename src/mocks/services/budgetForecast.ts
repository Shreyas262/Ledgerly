import type { BudgetForecast, BudgetScopeForecast, BudgetTrendPoint } from "../../features/budgets/types/budget";

/**
 * Budget forecasts (§28.19): where a level of an active budget is heading if
 * reimbursed and committed spend continue at the average daily rate so far.
 * Committed spend (approved, awaiting reimbursement) is part of the pace
 * because reimbursement trails approval; it is never counted as spend.
 */

/** A projection is given from this day of the period on. */
export const FORECAST_MIN_DAYS = 7;

const DAY_MS = 86_400_000;

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10);
const roundRupees = (value: number) => Math.round(value * 100) / 100;

/** Days from the first date to the second, both included. */
export function daysIncluding(startDate: string, endDate: string): number {
  return Math.round((toTime(endDate) - toTime(startDate)) / DAY_MS) + 1;
}

function addDays(date: string, days: number): string {
  return fromTime(toTime(date) + days * DAY_MS);
}

export interface ForecastInput {
  allocated: number;
  spent: number;
  committed: number;
  startDate: string;
  endDate: string;
  /** Today, within the period. */
  today: string;
}

/** The forecast of one level. Today must fall within the period. */
export function forecastBudget({ allocated, spent, committed, startDate, endDate, today }: ForecastInput): BudgetForecast {
  const totalDays = daysIncluding(startDate, endDate);
  const elapsedDays = Math.min(daysIncluding(startDate, today), totalDays);
  const used = spent + committed;
  const dailyRate = used / elapsedDays;
  const projectedAmount = elapsedDays >= FORECAST_MIN_DAYS ? roundRupees(dailyRate * totalDays) : null;
  const expectedByToday = roundRupees((allocated * elapsedDays) / totalDays);

  if (used > allocated) {
    return { elapsedDays, totalDays, projectedAmount, expectedByToday, runsOutOn: null, status: "OVER_COMMITTED", overBy: roundRupees(used - allocated) };
  }
  if (projectedAmount !== null && projectedAmount > allocated) {
    // The day on which spend at this rate reaches the allocation.
    const daysToReach = Math.ceil(allocated / dailyRate);
    return {
      elapsedDays,
      totalDays,
      projectedAmount,
      expectedByToday,
      runsOutOn: daysToReach <= totalDays ? addDays(startDate, daysToReach - 1) : null,
      status: "PROJECTED_OVER",
      overBy: roundRupees(projectedAmount - allocated),
    };
  }
  return { elapsedDays, totalDays, projectedAmount, expectedByToday, runsOutOn: null, status: "ON_TRACK", overBy: 0 };
}

/** Grouping of the running totals: by day up to 31 days, by week up to 92, by month beyond. */
export function trendGrouping(startDate: string, endDate: string): BudgetScopeForecast["grouping"] {
  const days = daysIncluding(startDate, endDate);
  return days <= 31 ? "day" : days <= 92 ? "week" : "month";
}

/** The last day of each group, from the period start, through the end of the period. */
function groupEnds(startDate: string, endDate: string, grouping: BudgetScopeForecast["grouping"]): string[] {
  const ends: string[] = [];
  let groupStart = startDate;
  while (groupStart <= endDate) {
    let groupEnd: string;
    if (grouping === "day") {
      groupEnd = groupStart;
    } else if (grouping === "week") {
      groupEnd = addDays(groupStart, 6);
    } else {
      const [year, month] = groupStart.split("-").map(Number);
      groupEnd = fromTime(Date.UTC(year, month, 0));
    }
    if (groupEnd > endDate) groupEnd = endDate;
    ends.push(groupEnd);
    groupStart = addDays(groupEnd, 1);
  }
  return ends;
}

interface DatedAmount {
  expenseDate: string;
  amount: number;
}

/**
 * Reimbursed and committed spend from the period start up to the end of each
 * group, the last group ending today.
 */
export function buildTrend(
  spent: DatedAmount[],
  committed: DatedAmount[],
  startDate: string,
  endDate: string,
  today: string,
): BudgetTrendPoint[] {
  const total = (items: DatedAmount[], through: string) =>
    roundRupees(items.reduce((sum, item) => (item.expenseDate.slice(0, 10) <= through ? sum + item.amount : sum), 0));
  const points: BudgetTrendPoint[] = [];
  let groupStart = startDate;
  for (const groupEnd of groupEnds(startDate, endDate, trendGrouping(startDate, endDate))) {
    if (groupStart > today) break;
    const date = groupEnd < today ? groupEnd : today;
    points.push({ date, spentAmount: total(spent, date), committedAmount: total(committed, date) });
    groupStart = addDays(groupEnd, 1);
  }
  return points;
}
