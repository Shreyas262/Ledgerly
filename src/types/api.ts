import type {
  CurrencyCode,
  ExpenseStatus,
  ID,
} from "./common";
import type { Expense, ExpenseCategory } from "./expense";
import type { AuthSession, User } from "./auth"

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

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  data: AuthSession;
}

export interface GetCurrentUserResponse {
  data: User;
}