import {
  Box,
  Button,
  Chip,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import type { ChipProps } from "@mui/material";

import { EXPENSE_TYPE_LABELS, type ExpenseStatus } from "../types/expense";
import type { Expense } from "../types/expense";

import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { useAuth } from "../../../features/auth/context/AuthContext";
import { Amount } from "../../../components/common/Amount";

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
  const { user } = useAuth();

  const status = statusConfig[expense.status];

  const canSubmit =
    variant === "default" &&
    expense.status === "draft" &&
    expense.employeeId === user?.id &&
    can("expenses.submit");

  const canStartReview =
    variant === "approval" &&
    (expense.employeeId !== user?.id || user?.role === "admin") &&
    expense.status === "submitted" &&
    can("expenses.approve");

  return (
    <Card>
      <CardContent>
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
            <Typography variant="subtitle1">
              {expense.title}
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
            >
              {EXPENSE_TYPE_LABELS[expense.type] ?? expense.type}
            </Typography>

            {expense.employeeId !== user?.id && expense.employeeName && (
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Submitted by {expense.employeeName}
                {expense.employeeRemoved ? " (removed)" : ""}
              </Typography>
            )}

            <Typography
              variant="body2"
              color="text.secondary"
            >
              {expense.teamName ?? expense.teamId} · {expense.departmentName ?? expense.departmentId}
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
            <Typography variant="h6">
              <Amount value={expense.amount} currency={expense.currency} />
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
              disabled={!expense.documentIds?.length}
              title={expense.documentIds?.length ? undefined : "Attach a receipt before submitting"}
            >
              {expense.documentIds?.length ? "Submit" : "Receipt required"}
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
      </CardContent>
    </Card>
  );
}