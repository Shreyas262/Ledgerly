import type { ID, ExpenseStatus } from "./common";

export interface Expense {
  id: ID;
  organizationId: ID;
  employeeId: ID;

  title: string;
  description: string;

  amount: number;
  currency: "INR";

  category: string;
  status: ExpenseStatus;
  rejectionReason?: string;

  expenseDate: string;

  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequest {
  title: string;
  description: string;
  amount: number;
  currency: "INR";
  category: string;
  expenseDate: string;
}

export interface UpdateExpenseRequest {
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: "INR";
  category: string;
  expenseDate: string;
}

export interface ExpenseFilter {
  search: string;
  status: ExpenseStatus | "all";
  category: string;
  dateFrom: string;
  dateTo: string;
}

export const initialExpenseFilters: ExpenseFilter = {
  search: "",
  status: "all",
  category: "all",
  dateFrom: "",
  dateTo: "",
};