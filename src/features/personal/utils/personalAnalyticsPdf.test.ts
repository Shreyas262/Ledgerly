import { describe, expect, it } from "vitest";

import { pdfTables, pdfText } from "../../../test/pdfText";
import type { PersonalAnalytics } from "../types/personal";
import { buildPersonalAnalyticsReport } from "./personalAnalyticsPdf";

function analytics(overrides: Partial<PersonalAnalytics> = {}): PersonalAnalytics {
  return {
    from: "2026-09",
    to: "2026-10",
    total: 12_000,
    count: 3,
    averagePerMonth: 6_000,
    largestExpense: {
      id: "personal-expense-1",
      ownerId: "user-personal-1",
      type: "GROCERIES",
      amount: 6_000,
      currency: "INR",
      expenseDate: "2026-10-02",
      description: "Monthly groceries",
      paymentMethod: "UPI",
      documentIds: [],
      createdAt: "2026-10-02T10:00:00.000Z",
      updatedAt: "2026-10-02T10:00:00.000Z",
    },
    monthly: [
      { month: "2026-09", amount: 4_000, budget: 5_000 },
      { month: "2026-10", amount: 8_000, budget: null },
    ],
    byType: [
      { type: "GROCERIES", amount: 9_000, count: 2 },
      { type: "DINING", amount: 3_000, count: 1 },
    ],
    byPaymentMethod: [{ paymentMethod: "UPI", amount: 12_000, count: 3 }],
    ...overrides,
  };
}

const build = (data = analytics()) =>
  buildPersonalAnalyticsReport({ analytics: data, generatedBy: "Priya Personal", generatedAt: new Date("2026-10-19T10:00:00") });

describe("buildPersonalAnalyticsReport", () => {
  it("summarises the period with the largest expense", () => {
    const text = pdfText(build());

    expect(text).toContain("Spending Analytics");
    expect(text).toContain("September 2026 to October 2026");
    expect(text).toMatch(/Total spent\n₹12,000\n3 expenses/);
    expect(text).toContain("Monthly groceries · 2 Oct 2026");
  });

  it("compares months with their budget where one was set", () => {
    const [monthly] = pdfTables(build());

    expect(monthly).toEqual([
      ["Month", "Spent", "Budget", "Remaining"],
      ["September 2026", "₹4,000", "₹5,000", "₹1,000"],
      ["October 2026", "₹8,000", "—", "—"],
      ["Total", "₹12,000", "", ""],
    ]);
  });

  it("leaves out budget columns when no month has a budget", () => {
    const [monthly] = pdfTables(build(analytics({ monthly: [{ month: "2026-10", amount: 12_000, budget: null }] })));

    expect(monthly[0]).toEqual(["Month", "Spent"]);
  });

  it("breaks spending down by expense type and payment method with each share", () => {
    const [, byType, byMethod] = pdfTables(build());

    expect(byType[1]).toEqual(["Groceries", "₹9,000", "2", "75%"]);
    expect(byMethod[1]).toEqual(["UPI", "₹12,000", "3", "100%"]);
  });

  it("explains a period without spending", () => {
    const text = pdfText(build(analytics({ total: 0, count: 0, largestExpense: null, byType: [], byPaymentMethod: [] })));

    expect(text).toContain("No spending in this period.");
  });
});
