export type ID = string;

export type CurrencyCode = "INR" | "USD";

export type ExpenseStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REJECTED"
  | "APPROVED"
  | "REIMBURSEMENT_PENDING"
  | "REIMBURSED"
  | "CANCELLED";