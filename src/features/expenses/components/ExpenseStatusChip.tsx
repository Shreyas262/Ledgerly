import { Chip, type ChipProps } from "@mui/material";

import { EXPENSE_STATUS_LABELS, type ExpenseStatus } from "../types/expense";

const STATUS_COLORS: Record<ExpenseStatus, ChipProps["color"]> = {
  draft: "default",
  submitted: "info",
  under_review: "warning",
  rejected: "error",
  approved: "success",
  reimbursement_pending: "warning",
  reimbursed: "success",
  cancelled: "default",
};

/** An expense's status as a labelled chip, coloured by workflow stage. */
export function ExpenseStatusChip({ status }: { status: ExpenseStatus }) {
  return <Chip label={EXPENSE_STATUS_LABELS[status]} color={STATUS_COLORS[status]} size="small" />;
}
