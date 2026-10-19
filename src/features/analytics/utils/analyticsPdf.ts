import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import { buildReport, figures, notice, section, shareCell, table } from "../../../services/pdf/pdfDocument";
import { formatMoney } from "../../../utils/currency";
import { formatDate } from "../../../utils/format";
import { EXPENSE_TYPE_LABELS } from "../../expenses/types/expense";
import { RULE_LABELS } from "../../policies/utils/policyText";
import type { AnalyticsInterval, AnalyticsSummary } from "../types/analytics";

export interface AnalyticsReportInput {
  summary: AnalyticsSummary;
  /** e.g. "Organization-wide" or "Your team". */
  scopeLabel: string;
  /** The filters as the page states them, e.g. "1 Oct 2026 to 19 Oct 2026 · Type: Travel". */
  filterDescription: string;
  organizationName?: string;
  generatedBy: string;
  generatedAt?: Date;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function periodLabel(period: string, interval: AnalyticsInterval): string {
  if (interval === "MONTH") return `${MONTHS[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`;
  return interval === "WEEK" ? `Week of ${formatDate(period)}` : formatDate(period);
}

/** "12% higher", "No change", or a dash without a previous figure, as on the headline cards. */
function change(current: number | null, previous: number | null): string {
  if (current === null || previous === null || previous <= 0) return "—";
  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 0.5) return "No change";
  return `${Math.abs(percent).toFixed(0)}% ${percent > 0 ? "higher" : "lower"}`;
}

const days = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)} days`);

/** The filtered analytics summary as a PDF (§26.6): the same content as the CSV export. */
export function buildAnalyticsReport({
  summary,
  scopeLabel,
  filterDescription,
  organizationName,
  generatedBy,
  generatedAt,
}: AnalyticsReportInput): TDocumentDefinitions {
  const { kpis, previousKpis, previousRange } = summary;
  const totalSpend = kpis.totalSpend;
  const content: Content[] = [];

  content.push(figures([
    { label: "Total spend", value: formatMoney(totalSpend) },
    { label: "Expenses", value: String(kpis.expenseCount) },
    { label: "Average expense", value: formatMoney(Math.round(kpis.averageExpense)) },
    { label: "Average time to reimbursement", value: days(kpis.averageDaysToReimburse) },
  ]));
  if (kpis.expenseCount === 0) {
    content.push(notice("No spend matches these filters. The policy figures below still include expenses that are in progress."));
  }

  content.push(section(
    "Compared with the previous period",
    notice(`Previous period: ${formatDate(previousRange.from)} to ${formatDate(previousRange.to)}.`),
    table(
      [{ header: "Metric", width: "*" }, { header: "This period", align: "right" }, { header: "Previous period", align: "right" }, { header: "Change", align: "right" }],
      [
        ["Total spend", formatMoney(totalSpend), formatMoney(previousKpis.totalSpend), change(totalSpend, previousKpis.totalSpend)],
        ["Average expense", formatMoney(Math.round(kpis.averageExpense)), formatMoney(Math.round(previousKpis.averageExpense)), change(kpis.averageExpense, previousKpis.averageExpense)],
        ["Largest expense", formatMoney(kpis.largestExpense), formatMoney(previousKpis.largestExpense), change(kpis.largestExpense, previousKpis.largestExpense)],
        ["Expenses", String(kpis.expenseCount), String(previousKpis.expenseCount), change(kpis.expenseCount, previousKpis.expenseCount)],
        ["Average time to reimbursement", days(kpis.averageDaysToReimburse), days(previousKpis.averageDaysToReimburse), change(kpis.averageDaysToReimburse, previousKpis.averageDaysToReimburse)],
      ],
    ),
  ));

  content.push(section(
    "Spending trend",
    table(
      [{ header: "Period", width: "*" }, { header: "Spend", align: "right" }, { header: "Expenses", align: "right" }],
      summary.spendingTrend.map((point) => [periodLabel(point.period, summary.interval), formatMoney(point.amount), String(point.count)]),
      ["Total", formatMoney(totalSpend), String(kpis.expenseCount)],
    ),
  ));

  const share = (amount: number) => shareCell(totalSpend > 0 ? amount / totalSpend : 0);
  content.push(section(
    "Spending by expense type",
    summary.expenseTypeSpending.length
      ? table(
          [{ header: "Expense type", width: "*" }, { header: "Spend", align: "right" }, { header: "Expenses", align: "right" }, { header: "Share" }],
          summary.expenseTypeSpending.map((item) => [EXPENSE_TYPE_LABELS[item.expenseType], formatMoney(item.amount), String(item.count), share(item.amount)]),
        )
      : notice("No spend in the selected period."),
  ));

  // Department and team comparisons are for Finance and Admin only (§26.1);
  // the API leaves them empty for the team scope.
  for (const [title, rows, dimension] of [
    ["Spending by department", summary.departmentSpending, "Department"],
    ["Spending by team", summary.teamSpending, "Team"],
  ] as const) {
    if (!rows.length) continue;
    content.push(section(
      title,
      table(
        [{ header: dimension, width: "*" }, { header: "Spend", align: "right" }, { header: "Share" }],
        rows.map((item) => [item.dimensionName, formatMoney(item.amount), share(item.amount)]),
      ),
    ));
  }

  if (summary.budgetComparison) {
    const budget = summary.budgetComparison;
    content.push(section(
      "Budget vs. actual spend",
      notice(`${budget.budgetName}, ${formatDate(budget.startDate)} to ${formatDate(budget.endDate)}: spend for the whole budget period.`),
      table(
        [{ header: "Name", width: "*" }, { header: "Allocated", align: "right" }, { header: "Spent", align: "right" }, { header: "Remaining", align: "right" }, { header: "Used", align: "right" }],
        budget.rows.map((row) => [
          row.name,
          formatMoney(row.allocated),
          formatMoney(row.spent),
          formatMoney(row.allocated - row.spent),
          row.allocated > 0 ? `${Math.round((row.spent / row.allocated) * 100)}%` : "—",
        ]),
      ),
    ));
  }

  const compliance = summary.policyCompliance;
  content.push(section(
    "Policy compliance",
    table(
      [{ header: "Metric", width: "*" }, { header: "Count", align: "right" }],
      [
        ["Checked against a policy", String(compliance.checked)],
        ["Above an approval threshold", String(compliance.escalated)],
        ["Submitted with warnings", String(compliance.withWarnings)],
        ["Blocked submission attempts", String(compliance.blockedAttempts)],
      ],
    ),
    ...(compliance.byRule.length
      ? [
          { text: "Findings by rule", bold: true, margin: [0, 10, 0, 4] } as Content,
          table(
            [{ header: "Rule", width: "*" }, { header: "Warnings", align: "right" }, { header: "Blocked", align: "right" }],
            compliance.byRule.map((row) => [RULE_LABELS[row.rule], String(row.warnings), String(row.blocked)]),
          ),
        ]
      : []),
    ...(compliance.blockedByDepartment.length
      ? [
          { text: "Blocked attempts by department", bold: true, margin: [0, 10, 0, 4] } as Content,
          table(
            [{ header: "Department", width: "*" }, { header: "Blocked", align: "right" }],
            compliance.blockedByDepartment.map((row) => [row.dimensionName, String(row.count)]),
          ),
        ]
      : []),
  ));

  return buildReport({
    title: "Spending Analytics",
    subtitle: [organizationName, scopeLabel].filter(Boolean).join(" · "),
    details: [filterDescription],
    note: "Spend includes reimbursed expenses only. Amounts are in rupees.",
    generatedBy,
    generatedAt,
    content,
  });
}
