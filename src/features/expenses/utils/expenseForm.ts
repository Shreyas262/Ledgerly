import type { CreateExpenseRequest, ExpenseType } from "../types/expense";

/** Values of the create and edit expense forms, as typed. */
export interface ExpenseFormData {
  type: ExpenseType;
  title: string;
  description: string;
  amount: string;
  expenseDate: string;
}

export const EMPTY_EXPENSE_FORM: ExpenseFormData = {
  type: "OTHER",
  title: "",
  description: "",
  amount: "",
  expenseDate: "",
};

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
    currency: "INR",
    expenseDate: form.expenseDate,
  };
}
