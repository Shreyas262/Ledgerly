import type { CurrencyCode } from "../../../types/common";
import { BASE_CURRENCY } from "../../../utils/currency";
import type { CreateExpenseRequest, Expense, ExpenseType } from "../types/expense";

/** Values of the create and edit expense forms, as typed. */
export interface ExpenseFormData {
  type: ExpenseType;
  title: string;
  description: string;
  /** The amount as paid, in `currency`. */
  amount: string;
  currency: CurrencyCode;
  expenseDate: string;
}

export const EMPTY_EXPENSE_FORM: ExpenseFormData = {
  type: "OTHER",
  title: "",
  description: "",
  amount: "",
  currency: BASE_CURRENCY,
  expenseDate: "",
};

/** An expense's values for editing, with the amount as it was paid. */
export function toExpenseForm(expense: Expense): ExpenseFormData {
  return {
    type: expense.type,
    title: expense.title,
    description: expense.description,
    amount: String(expense.conversion?.originalAmount ?? expense.amount),
    currency: expense.conversion?.originalCurrency ?? expense.currency,
    expenseDate: expense.expenseDate,
  };
}

/** Every field is filled in and the amount is a positive number. */
export function isExpenseFormComplete(form: ExpenseFormData): boolean {
  const amount = Number(form.amount);
  return Boolean(form.title.trim() && form.description.trim() && form.amount && form.expenseDate) &&
    Number.isFinite(amount) && amount > 0;
}

export function toExpenseRequest(form: ExpenseFormData): CreateExpenseRequest {
  return {
    type: form.type,
    title: form.title.trim(),
    description: form.description.trim(),
    amount: Number(form.amount),
    currency: form.currency,
    expenseDate: form.expenseDate,
  };
}
