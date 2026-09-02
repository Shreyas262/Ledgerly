import { Chip } from "@mui/material";

import type { ExpenseStatus } from "../../types/common";

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
  draft: {
    label: "Draft",
    color: "default",
  },
  submitted: {
    label: "Submitted",
    color: "info",
  },
  under_review: {
    label: "Under Review",
    color: "warning",
  },
  rejected: {
    label: "Rejected",
    color: "error",
  },
  approved: {
    label: "Approved",
    color: "success",
  },
  reimbursement_pending: {
    label: "Reimbursement Pending",
    color: "warning",
  },
  reimbursed: {
    label: "Reimbursed",
    color: "success",
  },
  cancelled: {
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