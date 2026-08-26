import { Chip } from "@mui/material";

import type { ExpenseStatus } from "../../../types/common";

interface StatusBadgeProps {
  status: ExpenseStatus;
}

const statusConfig: Record<
  ExpenseStatus,
  {
    label: string;
    color:
      | "default"
      | "primary"
      | "secondary"
      | "error"
      | "info"
      | "success"
      | "warning";
  }
> = {
  DRAFT: {
    label: "Draft",
    color: "default",
  },
  SUBMITTED: {
    label: "Submitted",
    color: "info",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "warning",
  },
  REJECTED: {
    label: "Rejected",
    color: "error",
  },
  APPROVED: {
    label: "Approved",
    color: "success",
  },
  REIMBURSEMENT_PENDING: {
    label: "Reimbursement Pending",
    color: "warning",
  },
  REIMBURSED: {
    label: "Reimbursed",
    color: "success",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "default",
  },
};

export function StatusBadge({
  status,
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Chip
      label={config.label}
      color={config.color}
      size="small"
    />
  );
}