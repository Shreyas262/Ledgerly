export type ID = string;

export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "rejected"
  | "approved"
  | "reimbursement_pending"
  | "reimbursed"
  | "cancelled";