import { describe, expect, it } from "vitest";

import { buildTrend, daysIncluding, forecastBudget, trendGrouping } from "./budgetForecast";

// A 30-day period: 1 to 30 November.
const november = { startDate: "2026-11-01", endDate: "2026-11-30" };

// §28.19: projections from reimbursed and committed spend at the pace so far.
describe("forecastBudget", () => {
  it("gives no projection during the first week, but the even pace", () => {
    expect(forecastBudget({ ...november, allocated: 30_000, spent: 6_000, committed: 0, today: "2026-11-06" })).toEqual({
      elapsedDays: 6,
      totalDays: 30,
      projectedAmount: null,
      expectedByToday: 6_000,
      runsOutOn: null,
      status: "ON_TRACK",
      overBy: 0,
    });
  });

  it("projects from the seventh day, counting committed spend in the pace", () => {
    // 7,000 in 10 days → 21,000 over 30 days.
    expect(forecastBudget({ ...november, allocated: 30_000, spent: 4_000, committed: 3_000, today: "2026-11-10" })).toMatchObject({
      elapsedDays: 10,
      projectedAmount: 21_000,
      expectedByToday: 10_000,
      status: "ON_TRACK",
      overBy: 0,
    });
  });

  it("warns when the pace leads over the allocation, with the day it runs out", () => {
    // 15,000 in 10 days: 1,500 a day reaches 30,000 on day 20 and 45,000 by the end.
    expect(forecastBudget({ ...november, allocated: 30_000, spent: 10_000, committed: 5_000, today: "2026-11-10" })).toMatchObject({
      projectedAmount: 45_000,
      runsOutOn: "2026-11-20",
      status: "PROJECTED_OVER",
      overBy: 15_000,
    });
  });

  it("says when reimbursed and committed spend already exceed the allocation, even in the first week", () => {
    expect(forecastBudget({ ...november, allocated: 10_000, spent: 4_000, committed: 7_500, today: "2026-11-03" })).toMatchObject({
      projectedAmount: null,
      runsOutOn: null,
      status: "OVER_COMMITTED",
      overBy: 1_500,
    });
  });

  it("rounds to the paisa", () => {
    expect(forecastBudget({ ...november, allocated: 1_00_000, spent: 1_000, committed: 0, today: "2026-11-07" }).projectedAmount).toBe(4_285.71);
  });

  it("counts days including both ends across months and years", () => {
    expect(daysIncluding("2026-11-01", "2026-11-30")).toBe(30);
    expect(daysIncluding("2026-12-31", "2027-01-01")).toBe(2);
    expect(daysIncluding("2026-01-01", "2026-12-31")).toBe(365);
  });
});

describe("running totals for the forecast chart", () => {
  it("groups by day up to 31 days, by week up to 92 and by month beyond", () => {
    expect(trendGrouping("2026-11-01", "2026-12-01")).toBe("day");
    expect(trendGrouping("2026-10-01", "2026-12-31")).toBe("week");
    expect(trendGrouping("2026-01-01", "2026-12-31")).toBe("month");
  });

  it("adds up reimbursed and committed spend separately through today", () => {
    const spent = [{ expenseDate: "2026-11-01", amount: 100 }, { expenseDate: "2026-11-03", amount: 50 }];
    const committed = [{ expenseDate: "2026-11-02", amount: 20 }, { expenseDate: "2026-11-05", amount: 999 }];

    expect(buildTrend(spent, committed, november.startDate, november.endDate, "2026-11-03")).toEqual([
      { date: "2026-11-01", spentAmount: 100, committedAmount: 0 },
      { date: "2026-11-02", spentAmount: 100, committedAmount: 20 },
      { date: "2026-11-03", spentAmount: 150, committedAmount: 20 },
    ]);
  });

  it("ends weekly and monthly groups on their last day, the current one on today", () => {
    const spent = [{ expenseDate: "2026-02-10", amount: 500 }];

    expect(buildTrend(spent, [], "2026-01-01", "2026-12-31", "2026-03-15").map((point) => point.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-15",
    ]);
    expect(buildTrend(spent, [], "2026-01-01", "2026-03-31", "2026-01-20").map((point) => point.date)).toEqual([
      "2026-01-07",
      "2026-01-14",
      "2026-01-20",
    ]);
  });
});
