import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { ChipProps } from "@mui/material";

import type { ExpenseStatus } from "../../../types/common";
import type { Expense } from "../../../types/expense";

import { usePermissions } from "../../../features/auth/hooks/usePermissions";

interface ExpenseCardProps {
  expense: Expense;
  variant?: "default" | "approval";
  onView: (expense: Expense) => void;
  onSubmit?: (expense: Expense) => void;
  onStartReview?: (expense: Expense) => void;
  isSubmitting?: boolean;
  isStartingReview?: boolean;
}

interface StatusConfig {
  label: string;
  color: ChipProps["color"];
}

const statusConfig: Record<
  ExpenseStatus,
  StatusConfig
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

export function ExpenseCard({
  expense,
  variant = "default",
  onView,
  onSubmit,
  onStartReview,
  isSubmitting = false,
  isStartingReview = false,
}: ExpenseCardProps) {
  const { can } = usePermissions();

  const status = statusConfig[expense.status];

  const canSubmit =
    variant === "default" &&
    expense.status === "draft" &&
    can("expenses.submit");

  const canStartReview =
    variant === "approval" &&
    expense.status === "submitted" &&
    can("expenses.approve");

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box
          sx={{
            display: "flex",
            flexDirection: {
              xs: "column",
              sm: "row",
            },
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Stack spacing={0.5}>
            <Typography variant="h6">
              {expense.title}
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
            >
              {expense.category}
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
            >
              {expense.expenseDate}
            </Typography>
          </Stack>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: {
                xs: "flex-start",
                sm: "flex-end",
              },
              gap: 1,
            }}
          >
            <Typography
              variant="h6"
              sx={{ fontWeight: 600 }}
            >
              {expense.currency}{" "}
              {expense.amount.toLocaleString()}
            </Typography>

            <Chip
              label={status.label}
              color={status.color}
              size="small"
            />
          </Box>
        </Box>

        <Stack
          direction={{
            xs: "column",
            sm: "row",
          }}
          spacing={1}
          sx={{
            justifyContent: "flex-end",
          }}
        >
          <Button
            variant="outlined"
            onClick={() => onView(expense)}
          >
            View
          </Button>

          {canSubmit && (
            <Button
              variant="contained"
              onClick={() => onSubmit?.(expense)}
              loading={isSubmitting}
            >
              Submit
            </Button>
          )}

          {canStartReview && (
            <Button
              variant="contained"
              onClick={() =>
                onStartReview?.(expense)
              }
              loading={isStartingReview}
            >
              Start Review
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}