import type { TableCell, TDocumentDefinitions } from "pdfmake/interfaces";

import { buildReport, figures, notice, section, table, type TableColumn } from "../../../services/pdf/pdfDocument";
import { formatMoney } from "../../../utils/currency";
import { formatDate } from "../../../utils/format";
import { describePaidAmount } from "../../currency/utils/rateText";
import { EXPENSE_STATUS_LABELS, EXPENSE_TYPE_LABELS, type Expense, type ExpenseFilter } from "../types/expense";

/** Most expenses one report lists; narrower filters cover the rest. */
export const MAX_REPORT_EXPENSES = 500;

/** The filters in use on the Expenses page, one line each. */
export function describeExpenseFilters(filters: ExpenseFilter): string[] {
  const lines: string[] = [];
  if (filters.dateFrom && filters.dateTo) lines.push(`Dates: ${formatDate(filters.dateFrom)} to ${formatDate(filters.dateTo)}`);
  else if (filters.dateFrom) lines.push(`Dates: from ${formatDate(filters.dateFrom)}`);
  else if (filters.dateTo) lines.push(`Dates: until ${formatDate(filters.dateTo)}`);
  if (filters.status !== "all") lines.push(`Status: ${EXPENSE_STATUS_LABELS[filters.status]}`);
  if (filters.type !== "all") lines.push(`Expense type: ${EXPENSE_TYPE_LABELS[filters.type]}`);
  if (filters.search.trim()) lines.push(`Search: "${filters.search.trim()}"`);
  return lines;
}

export interface ExpenseReportInput {
  /** The expenses listed, newest first. */
  expenses: Expense[];
  /** How many expenses match the view; more than listed when the report is capped. */
  matching: number;
  /** e.g. "My Expenses" or "Team Expenses". */
  viewLabel: string;
  /** One line per filter in use, e.g. "Status: Approved". */
  filters: string[];
  /** Wider views name whose expense each one is. */
  showEmployee: boolean;
  organizationName?: string;
  generatedBy: string;
  generatedAt?: Date;
}

const sum = (expenses: Expense[]) => Math.round(expenses.reduce((total, expense) => total + expense.amount, 0) * 100) / 100;

/** The expenses of an Expenses view, with every page included, as a PDF. */
export function buildExpenseReport({
  expenses,
  matching,
  viewLabel,
  filters,
  showEmployee,
  organizationName,
  generatedBy,
  generatedAt,
}: ExpenseReportInput): TDocumentDefinitions {
  const reimbursed = expenses.filter((expense) => expense.status === "reimbursed");
  const anyPaidInOtherCurrency = expenses.some((expense) => expense.conversion);

  const columns: TableColumn[] = [
    { header: "Date" },
    { header: "Title", width: "*" },
    ...(showEmployee ? [{ header: "Employee" }] : []),
    { header: "Expense type" },
    { header: "Status" },
    { header: "Amount", align: "right" as const },
    ...(anyPaidInOtherCurrency ? [{ header: "Paid as", align: "right" as const }] : []),
  ];
  const rows: TableCell[][] = expenses.map((expense) => [
    formatDate(expense.expenseDate),
    expense.title,
    ...(showEmployee ? [`${expense.employeeName ?? "—"}${expense.employeeRemoved ? " (removed)" : ""}`] : []),
    EXPENSE_TYPE_LABELS[expense.type] ?? expense.type,
    EXPENSE_STATUS_LABELS[expense.status] ?? expense.status,
    formatMoney(expense.amount),
    ...(anyPaidInOtherCurrency ? [expense.conversion ? describePaidAmount(expense.conversion) : "—"] : []),
  ]);
  const totalRow = columns.map((column, index) =>
    index === 0 ? "Total" : column.header === "Amount" ? formatMoney(sum(expenses)) : "",
  );

  return buildReport({
    title: "Expense Report",
    subtitle: [organizationName, viewLabel].filter(Boolean).join(" · "),
    details: filters.length ? filters : ["All expenses in this view"],
    note: "Spend includes reimbursed expenses only; the total covers every listed expense. Amounts are in rupees.",
    generatedBy,
    generatedAt,
    content: [
      figures([
        { label: "Expenses listed", value: String(expenses.length) },
        { label: "Total of listed expenses", value: formatMoney(sum(expenses)) },
        { label: "Reimbursed (spend)", value: formatMoney(sum(reimbursed)), detail: `${reimbursed.length} ${reimbursed.length === 1 ? "expense" : "expenses"}` },
      ]),
      ...(matching > expenses.length
        ? [notice(`This report lists the first ${expenses.length} of ${matching} matching expenses. Narrow the filters to include the rest.`)]
        : []),
      section(
        "Expenses",
        expenses.length ? table(columns, rows, totalRow) : notice("No expenses match this view."),
      ),
    ],
  });
}
