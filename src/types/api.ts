import type {
  CurrencyCode,
  ExpenseStatus,
  ID,
} from "./common";
import type { Expense, ExpenseCategory } from "./expense";

export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  total: number;
}

export interface ApiError {
  message: string;
  code: string;
}

export interface GetExpensesParams {
  status?: ExpenseStatus;
  category?: ExpenseCategory;
  employeeId?: ID;
}

export interface CreateExpenseRequest {
  amount: number;
  currency: CurrencyCode;
  category: ExpenseCategory;
  merchant: string;
  description: string;
  expenseDate: string;
}

export interface UpdateExpenseRequest {
  amount?: number;
  currency?: CurrencyCode;
  category?: ExpenseCategory;
  merchant?: string;
  description?: string;
  expenseDate?: string;
}

export interface SubmitExpenseResponse {
  data: Expense;
}