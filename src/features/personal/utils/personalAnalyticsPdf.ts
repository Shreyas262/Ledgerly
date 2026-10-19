import type { TDocumentDefinitions } from "pdfmake/interfaces";

import { buildReport, figures, notice, section, shareCell, table } from "../../../services/pdf/pdfDocument";
import { formatMoney } from "../../../utils/currency";
import { formatDate } from "../../../utils/format";
import { PAYMENT_METHOD_LABELS, PERSONAL_EXPENSE_TYPE_LABELS, type PersonalAnalytics } from "../types/personal";
import { formatMonth } from "./personalFormat";

export interface PersonalAnalyticsReportInput {
  analytics: PersonalAnalytics;
  generatedBy: string;
  generatedAt?: Date;
}

/** A personal account's spending analytics for a range of months, as a PDF. */
export function buildPersonalAnalyticsReport({ analytics, generatedBy, generatedAt }: PersonalAnalyticsReportInput): TDocumentDefinitions {
  const { total, count, monthly, byType, byPaymentMethod, largestExpense } = analytics;
  const share = (amount: number) => shareCell(total > 0 ? amount / total : 0);
  const hasBudgets = monthly.some((point) => point.budget !== null);

  return buildReport({
    title: "Spending Analytics",
    subtitle: "Personal",
    details: [`${formatMonth(analytics.from)} to ${formatMonth(analytics.to)}`],
    note: "Amounts are in rupees; expenses paid in other currencies are included at their converted amount.",
    generatedBy,
    generatedAt,
    content: [
      figures([
        { label: "Total spent", value: formatMoney(total), detail: `${count} ${count === 1 ? "expense" : "expenses"}` },
        { label: "Average per month", value: formatMoney(Math.round(analytics.averagePerMonth)), detail: `Over ${monthly.length} ${monthly.length === 1 ? "month" : "months"}` },
        {
          label: "Largest expense",
          value: largestExpense ? formatMoney(largestExpense.amount) : "—",
          detail: largestExpense ? `${largestExpense.description} · ${formatDate(largestExpense.expenseDate)}` : undefined,
        },
      ]),
      ...(total === 0 ? [notice("No spending in this period.")] : []),
      section(
        "Monthly spending",
        table(
          [
            { header: "Month", width: "*" },
            { header: "Spent", align: "right" },
            ...(hasBudgets ? [{ header: "Budget", align: "right" as const }, { header: "Remaining", align: "right" as const }] : []),
          ],
          monthly.map((point) => [
            formatMonth(point.month),
            formatMoney(point.amount),
            ...(hasBudgets
              ? point.budget === null
                ? ["—", "—"]
                : [formatMoney(point.budget), formatMoney(Math.round((point.budget - point.amount) * 100) / 100)]
              : []),
          ]),
          ["Total", formatMoney(total), ...(hasBudgets ? ["", ""] : [])],
        ),
      ),
      section(
        "By expense type",
        byType.length
          ? table(
              [{ header: "Expense type", width: "*" }, { header: "Spent", align: "right" }, { header: "Expenses", align: "right" }, { header: "Share" }],
              byType.map((item) => [PERSONAL_EXPENSE_TYPE_LABELS[item.type], formatMoney(item.amount), String(item.count), share(item.amount)]),
            )
          : notice("No spending in this period."),
      ),
      section(
        "By payment method",
        byPaymentMethod.length
          ? table(
              [{ header: "Payment method", width: "*" }, { header: "Spent", align: "right" }, { header: "Expenses", align: "right" }, { header: "Share" }],
              byPaymentMethod.map((item) => [PAYMENT_METHOD_LABELS[item.paymentMethod], formatMoney(item.amount), String(item.count), share(item.amount)]),
            )
          : notice("No spending in this period."),
      ),
    ],
  });
}
