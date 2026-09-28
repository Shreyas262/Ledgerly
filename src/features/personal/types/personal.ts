import type {
  CurrencyCode,
  EntityId,
  ISODateString,
  ResourceTimestamps,
} from "../../../types/common";

/** Expense types for personal spending; independent of organization expense types. */
export type PersonalExpenseType =
  | "GROCERIES"
  | "DINING"
  | "HOUSING"
  | "UTILITIES"
  | "TRANSPORT"
  | "HEALTH"
  | "SHOPPING"
  | "ENTERTAINMENT"
  | "TRAVEL"
  | "EDUCATION"
  | "SUBSCRIPTIONS"
  | "OTHER";

export const PERSONAL_EXPENSE_TYPE_LABELS: Record<PersonalExpenseType, string> = {
  GROCERIES: "Groceries",
  DINING: "Dining",
  HOUSING: "Housing",
  UTILITIES: "Utilities",
  TRANSPORT: "Transport",
  HEALTH: "Health",
  SHOPPING: "Shopping",
  ENTERTAINMENT: "Entertainment",
  TRAVEL: "Travel",
  EDUCATION: "Education",
  SUBSCRIPTIONS: "Subscriptions",
  OTHER: "Other",
};

export const PERSONAL_EXPENSE_TYPES = Object.keys(PERSONAL_EXPENSE_TYPE_LABELS) as PersonalExpenseType[];

export type PaymentMethod =
  | "CASH"
  | "DEBIT_CARD"
  | "CREDIT_CARD"
  | "UPI"
  | "BANK_TRANSFER"
  | "WALLET"
  | "OTHER";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  DEBIT_CARD: "Debit card",
  CREDIT_CARD: "Credit card",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  WALLET: "Wallet",
  OTHER: "Other",
};

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

export interface PersonalExpense extends ResourceTimestamps {
  id: EntityId;
  ownerId: EntityId;
  type: PersonalExpenseType;
  amount: number;
  currency: CurrencyCode;
  /** Calendar date, YYYY-MM-DD. */
  expenseDate: string;
  description: string;
  paymentMethod: PaymentMethod;
  documentIds: EntityId[];
}

export interface PersonalExpenseRequest {
  type: PersonalExpenseType;
  amount: number;
  expenseDate: string;
  description: string;
  paymentMethod: PaymentMethod;
}

export interface PersonalExpenseFilter {
  search: string;
  type: PersonalExpenseType | "all";
  paymentMethod: PaymentMethod | "all";
  dateFrom: string;
  dateTo: string;
}

export const initialPersonalExpenseFilters: PersonalExpenseFilter = {
  search: "",
  type: "all",
  paymentMethod: "all",
  dateFrom: "",
  dateTo: "",
};

/** A spending limit for one expense type within a monthly budget. */
export interface PersonalBudgetTypeLimit {
  type: PersonalExpenseType;
  amount: number;
}

export interface PersonalBudget extends ResourceTimestamps {
  id: EntityId;
  ownerId: EntityId;
  /** Calendar month, YYYY-MM. One budget per month. */
  month: string;
  amount: number;
  typeLimits: PersonalBudgetTypeLimit[];
}

export interface PersonalBudgetTypeUsage extends PersonalBudgetTypeLimit {
  spent: number;
}

/** A budget with its spending, derived by the API. */
export interface PersonalBudgetWithUsage extends PersonalBudget {
  spent: number;
  remaining: number;
  utilizationPercent: number;
  typeUsage: PersonalBudgetTypeUsage[];
}

export interface PersonalBudgetRequest {
  month: string;
  amount: number;
  typeLimits: PersonalBudgetTypeLimit[];
}

export interface PersonalTypeBreakdown {
  type: PersonalExpenseType;
  amount: number;
  count: number;
}

export interface PersonalSummary {
  /** Calendar month the summary describes, YYYY-MM. */
  month: string;
  monthSpent: number;
  previousMonthSpent: number;
  monthCount: number;
  budget: PersonalBudgetWithUsage | null;
  byType: PersonalTypeBreakdown[];
  recent: PersonalExpense[];
}

export interface PersonalMonthlyPoint {
  month: string;
  amount: number;
  budget: number | null;
}

export interface PersonalAnalytics {
  from: string;
  to: string;
  total: number;
  count: number;
  averagePerMonth: number;
  largestExpense: PersonalExpense | null;
  monthly: PersonalMonthlyPoint[];
  byType: PersonalTypeBreakdown[];
  byPaymentMethod: Array<{ paymentMethod: PaymentMethod; amount: number; count: number }>;
}

export interface PersonalDocument {
  id: EntityId;
  ownerId: EntityId;
  expenseId: EntityId;
  fileName: string;
  mimeType: string;
  size: number;
  status: "ACTIVE" | "REMOVED";
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
