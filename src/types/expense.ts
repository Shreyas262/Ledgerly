import type { ExpenseStatus, ID, CurrencyCode } from "./common";

export type ExpenseCategory =
  | "MEALS"
  | "TRAVEL"
  | "ENTERTAINMENT"
  | "OFFICE"
  | "OTHER";

export interface Expense {
  id: ID;
  organizationId: ID;
  employeeId: ID;

  amount: number;
  currency: CurrencyCode;

  category: ExpenseCategory;
  merchant: string;
  description: string;
  expenseDate: string;

  projectId?: ID;
  costCenterId?: ID;

  status: ExpenseStatus;

  receiptUrl?: string;

  submittedAt?: string;
  reviewedAt?: string;
  approvedBy?: ID;

  rejectionReason?: string;

  reimbursementStatus: ReimbursementStatus;

  createdAt: string;
  updatedAt: string;
}

export type ReimbursementStatus =
  | "NOT_APPLICABLE"
  | "PENDING"
  | "COMPLETED";