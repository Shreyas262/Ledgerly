import { describe, expect, it } from "vitest";

import { pdfTables, pdfText } from "../../../test/pdfText";
import type { AnalyticsKpis, AnalyticsSummary } from "../types/analytics";
import { buildAnalyticsReport, type AnalyticsReportInput } from "./analyticsPdf";

const kpis = (overrides: Partial<AnalyticsKpis> = {}): AnalyticsKpis => ({
  totalSpend: 1_23_456,
  averageExpense: 4_115.2,
  largestExpense: 25_000,
  expenseCount: 30,
  averageDaysToReimburse: 3.25,
  ...overrides,
});

function summary(overrides: Partial<AnalyticsSummary> = {}): AnalyticsSummary {
  return {
    scope: "ORGANIZATION",
    filters: { from: "2026-08-01", to: "2026-10-31" },
    interval: "MONTH",
    kpis: kpis(),
    previousKpis: kpis({ totalSpend: 1_10_000, expenseCount: 30, averageDaysToReimburse: null }),
    previousRange: { from: "2026-05-01", to: "2026-07-31" },
    spendingTrend: [
      { period: "2026-08", amount: 40_000, count: 10, byType: {} },
      { period: "2026-09", amount: 50_000, count: 12, byType: {} },
      { period: "2026-10", amount: 33_456, count: 8, byType: {} },
    ],
    expenseTypeSpending: [
      { expenseType: "TRAVEL", amount: 92_592, count: 20 },
      { expenseType: "MEALS", amount: 30_864, count: 10 },
    ],
    departmentSpending: [{ dimensionId: "dept-engineering", dimensionName: "Engineering", amount: 1_23_456 }],
    teamSpending: [{ dimensionId: "team-engineering", dimensionName: "Platform", amount: 1_23_456 }],
    approvalMetrics: { approvalRate: 90, rejectionRate: 10, pendingReview: 2, totalReviewed: 32 },
    statusCounts: [],
    filterOptions: { departments: [], teams: [] },
    budgetComparison: {
      budgetName: "FY 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      level: "DEPARTMENT",
      rows: [{ id: "dept-engineering", name: "Engineering", allocated: 2_00_000, spent: 1_50_000 }],
    },
    policyCompliance: {
      checked: 28,
      escalated: 4,
      withWarnings: 3,
      blockedAttempts: 2,
      byRule: [{ rule: "maximumAmount", warnings: 1, blocked: 2 }],
      blockedByDepartment: [{ dimensionId: "dept-engineering", dimensionName: "Engineering", count: 2 }],
    },
    ...overrides,
  };
}

const input = (overrides: Partial<AnalyticsReportInput> = {}): AnalyticsReportInput => ({
  summary: summary(),
  scopeLabel: "Organization-wide",
  filterDescription: "1 Aug 2026 to 31 Oct 2026 · Type: Travel",
  organizationName: "Acme Corp",
  generatedBy: "Asha Admin",
  generatedAt: new Date("2026-10-19T10:00:00"),
  ...overrides,
});

const tableStartingWith = (report: ReturnType<typeof buildAnalyticsReport>, header: string) =>
  pdfTables(report).find((rows) => rows[0][0] === header);

describe("buildAnalyticsReport", () => {
  it("names the scope and filters and says spend counts reimbursed expenses only", () => {
    const text = pdfText(buildAnalyticsReport(input()));

    expect(text).toContain("Spending Analytics");
    expect(text).toContain("Acme Corp · Organization-wide");
    expect(text).toContain("1 Aug 2026 to 31 Oct 2026 · Type: Travel");
    expect(text).toContain("Spend includes reimbursed expenses only. Amounts are in rupees.");
  });

  it("compares the headline figures with the previous period", () => {
    const report = buildAnalyticsReport(input());

    expect(pdfText(report)).toContain("Previous period: 1 May 2026 to 31 Jul 2026.");
    expect(tableStartingWith(report, "Metric")?.slice(1, 6)).toEqual([
      ["Total spend", "₹1,23,456", "₹1,10,000", "12% higher"],
      ["Average expense", "₹4,115", "₹4,115", "No change"],
      ["Largest expense", "₹25,000", "₹25,000", "No change"],
      ["Expenses", "30", "30", "No change"],
      ["Average time to reimbursement", "3.3 days", "—", "—"],
    ]);
  });

  it("includes the trend, expense types with their share, departments, teams, budget and policy figures", () => {
    const report = buildAnalyticsReport(input());

    expect(tableStartingWith(report, "Period")?.slice(1)).toEqual([
      ["Aug 2026", "₹40,000", "10"],
      ["Sep 2026", "₹50,000", "12"],
      ["Oct 2026", "₹33,456", "8"],
      ["Total", "₹1,23,456", "30"],
    ]);
    expect(tableStartingWith(report, "Expense type")?.[1]).toEqual(["Travel", "₹92,592", "20", "75%"]);
    expect(tableStartingWith(report, "Department")?.[1]).toEqual(["Engineering", "₹1,23,456", "100%"]);
    expect(tableStartingWith(report, "Team")?.[1]).toEqual(["Platform", "₹1,23,456", "100%"]);
    expect(tableStartingWith(report, "Name")?.[1]).toEqual(["Engineering", "₹2,00,000", "₹1,50,000", "₹50,000", "75%"]);
    expect(tableStartingWith(report, "Rule")?.[1]).toEqual(["Maximum amount", "1", "2"]);
    expect(pdfText(report)).toContain("Blocked attempts by department");
  });

  it("leaves out department and team comparisons the scope does not include", () => {
    const report = buildAnalyticsReport(input({
      scopeLabel: "Your team",
      summary: summary({ scope: "TEAM", departmentSpending: [], teamSpending: [], budgetComparison: null }),
    }));

    const text = pdfText(report);
    expect(text).not.toContain("Spending by department");
    expect(text).not.toContain("Spending by team");
    expect(text).not.toContain("Budget vs. actual spend");
  });

  it("says when no spend matches the filters", () => {
    const report = buildAnalyticsReport(input({
      summary: summary({ kpis: kpis({ totalSpend: 0, expenseCount: 0, averageExpense: 0, largestExpense: 0 }), expenseTypeSpending: [] }),
    }));

    expect(pdfText(report)).toContain("No spend matches these filters.");
    expect(pdfText(report)).toContain("No spend in the selected period.");
  });

  it("labels weekly and daily trends by date", () => {
    const report = buildAnalyticsReport(input({
      summary: summary({ interval: "WEEK", spendingTrend: [{ period: "2026-10-05", amount: 100, count: 1, byType: {} }] }),
    }));

    expect(tableStartingWith(report, "Period")?.[1][0]).toBe("Week of 5 Oct 2026");
  });
});
