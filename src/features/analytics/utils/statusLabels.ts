import type { ExpenseStatus } from "../../expenses/types/expense";

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  reimbursement_pending: "Reimbursement pending",
  reimbursed: "Reimbursed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
