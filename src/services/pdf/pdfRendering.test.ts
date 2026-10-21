import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { beforeAll, describe, expect, it } from "vitest";

import { buildAnalyticsReport } from "../../features/analytics/utils/analyticsPdf";
import type { AnalyticsKpis } from "../../features/analytics/types/analytics";
import type { Expense } from "../../features/expenses/types/expense";
import { buildExpenseReport } from "../../features/expenses/utils/expenseReportPdf";
import { buildPersonalAnalyticsReport } from "../../features/personal/utils/personalAnalyticsPdf";

// The browser creates PDFs with pdfmake's browser build; the same document
// definitions are rendered here with its Node build to prove they are valid.
const require = createRequire(import.meta.url);
const regularFont = require.resolve("pdfmake/build/fonts/Roboto/Roboto-Regular.ttf");
const mediumFont = require.resolve("pdfmake/build/fonts/Roboto/Roboto-Medium.ttf");

let render: (definition: TDocumentDefinitions) => Promise<string>;

beforeAll(async () => {
  const { default: pdfMake } = await import("pdfmake");
  pdfMake.setFonts({ Roboto: { normal: regularFont, bold: mediumFont, italics: regularFont, bolditalics: mediumFont } });
  pdfMake.setUrlAccessPolicy(() => false);
  pdfMake.setLocalAccessPolicy((path) => path.startsWith(dirname(regularFont)));
  render = async (definition) => (await pdfMake.createPdf(definition).getBuffer()).toString("latin1");
});

const pageCount = (pdf: string) => pdf.match(/\/Type \/Page\b/g)?.length ?? 0;
const generated = { generatedBy: "Asha Admin", generatedAt: new Date("2026-10-19T10:00:00") };

function expense(index: number): Expense {
  return {
    id: `expense-${index}`,
    organizationId: "org-1",
    departmentId: "dept-engineering",
    teamId: "team-engineering",
    employeeId: "user-1",
    employeeName: "Esha Employee",
    type: "TRAVEL",
    title: `Trip ${index}`,
    amount: 1_000 + index,
    currency: "INR",
    ...(index % 3 === 0
      ? { conversion: { originalAmount: 12, originalCurrency: "USD" as const, rate: 94.96, rateDate: "2026-10-16", source: "ECB" as const } }
      : {}),
    description: "Travel",
    expenseDate: "2026-10-01",
    status: index % 2 ? "reimbursed" : "approved",
    documentIds: [],
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  };
}

describe("PDF reports", () => {
  it("render as PDF documents with the rupee font, over as many pages as they need", async () => {
    const pdf = await render(buildExpenseReport({
      expenses: Array.from({ length: 120 }, (_, index) => expense(index)),
      matching: 120,
      viewLabel: "Organization Expenses",
      filters: [],
      showEmployee: true,
      ...generated,
    }));

    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf).toContain("Roboto-Regular");
    expect(pageCount(pdf)).toBeGreaterThan(1);
  });

  it("render the analytics summaries", async () => {
    const kpis: AnalyticsKpis = { totalSpend: 1_000, averageExpense: 500, largestExpense: 700, expenseCount: 2, averageDaysToReimburse: 2 };
    const analytics = await render(buildAnalyticsReport({
      summary: {
        scope: "ORGANIZATION",
        filters: { from: "2026-10-01", to: "2026-10-31" },
        interval: "DAY",
        kpis,
        previousKpis: kpis,
        previousRange: { from: "2026-08-31", to: "2026-09-30" },
        spendingTrend: [{ period: "2026-10-01", amount: 1_000, count: 2, byType: { TRAVEL: 1_000 } }],
        expenseTypeSpending: [{ expenseType: "TRAVEL", amount: 1_000, count: 2 }],
        departmentSpending: [],
        teamSpending: [],
        approvalMetrics: { approvalRate: 100, rejectionRate: 0, pendingReview: 0, totalReviewed: 2 },
        statusCounts: [],
        filterOptions: { departments: [], teams: [] },
        budgetComparison: null,
        policyCompliance: { checked: 2, escalated: 0, withWarnings: 0, blockedAttempts: 0, byRule: [], blockedByDepartment: [] },
      },
      scopeLabel: "Organization-wide",
      filterDescription: "1 Oct 2026 to 31 Oct 2026",
      ...generated,
    }));
    const personal = await render(buildPersonalAnalyticsReport({
      analytics: {
        from: "2026-10",
        to: "2026-10",
        total: 0,
        count: 0,
        averagePerMonth: 0,
        largestExpense: null,
        monthly: [{ month: "2026-10", amount: 0, budget: 5_000 }],
        byType: [],
        byPaymentMethod: [],
      },
      ...generated,
    }));

    expect(analytics.startsWith("%PDF-")).toBe(true);
    expect(personal.startsWith("%PDF-")).toBe(true);
  });
});
