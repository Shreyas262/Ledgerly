import type { AnalyticsSummary } from "../types/analytics";
import { EXPENSE_TYPE_LABELS } from "../../expenses/types/expense";
import { RULE_LABELS } from "../../policies/utils/policyText";

const cell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Downloads the filtered summary as a CSV file (§26.6). */
export function exportAnalyticsCsv(summary: AnalyticsSummary, filterDescription: string): void {
  const rows: Array<Array<string | number>> = [];
  const section = (title: string, header: string[], body: Array<Array<string | number>>) => {
    rows.push([title], header, ...body, []);
  };

  rows.push(["Ledgerly analytics"], ["Filters", filterDescription], ["Spend includes reimbursed expenses only"], []);
  section("Summary", ["Metric", "Current period", "Previous period"], [
    ["Total spend (INR)", summary.kpis.totalSpend, summary.previousKpis.totalSpend],
    ["Average expense (INR)", Math.round(summary.kpis.averageExpense), Math.round(summary.previousKpis.averageExpense)],
    ["Largest expense (INR)", summary.kpis.largestExpense, summary.previousKpis.largestExpense],
    ["Expenses", summary.kpis.expenseCount, summary.previousKpis.expenseCount],
    ["Average days to reimbursement", summary.kpis.averageDaysToReimburse?.toFixed(1) ?? "", summary.previousKpis.averageDaysToReimburse?.toFixed(1) ?? ""],
  ]);
  section("Spending trend", ["Period", "Amount (INR)", "Expenses"],
    summary.spendingTrend.map((point) => [point.period, point.amount, point.count]));
  section("Spending by expense type", ["Expense type", "Amount (INR)", "Expenses"],
    summary.expenseTypeSpending.map((item) => [EXPENSE_TYPE_LABELS[item.expenseType], item.amount, item.count]));
  if (summary.departmentSpending.length) {
    section("Spending by department", ["Department", "Amount (INR)"],
      summary.departmentSpending.map((item) => [item.dimensionName, item.amount]));
  }
  if (summary.teamSpending.length) {
    section("Spending by team", ["Team", "Amount (INR)"],
      summary.teamSpending.map((item) => [item.dimensionName, item.amount]));
  }
  if (summary.budgetComparison) {
    const budget = summary.budgetComparison;
    section(`Budget vs. actual spend: ${budget.budgetName} (${budget.startDate} to ${budget.endDate})`, ["Name", "Allocated (INR)", "Spent (INR)"],
      budget.rows.map((row) => [row.name, row.allocated, row.spent]));
  }
  const compliance = summary.policyCompliance;
  section("Policy compliance", ["Metric", "Count"], [
    ["Checked against a policy", compliance.checked],
    ["Above approval threshold", compliance.escalated],
    ["Submitted with warnings", compliance.withWarnings],
    ["Blocked submission attempts", compliance.blockedAttempts],
  ]);
  if (compliance.byRule.length) {
    section("Policy findings by rule", ["Rule", "Warnings", "Blocked"],
      compliance.byRule.map((row) => [RULE_LABELS[row.rule], row.warnings, row.blocked]));
  }

  const csv = rows.map((row) => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `ledgerly-analytics-${summary.filters.from}-to-${summary.filters.to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
