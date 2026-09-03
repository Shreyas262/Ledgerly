import {
  Alert,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import { ArrowBackOutlined } from "@mui/icons-material";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  useGetExpenseByIdQuery,
  useSubmitExpenseMutation,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
} from "../../../features/expenses/api/expenseApi";

import { evaluateExpensePolicy } from "../../approvals/utils/evaluateExpensePolicy";
import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { useState } from "react";

import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";

import type { ExpenseStatus } from "../../../types/common";

export type ExpenseDetailsMode =
  | "default"
  | "review";

interface ExpenseDetailsPageProps {
  mode?: ExpenseDetailsMode;
}

const statusLabels: Record<
  ExpenseStatus,
  string
> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  rejected: "Rejected",
  approved: "Approved",
  reimbursement_pending:
    "Reimbursement Pending",
  reimbursed: "Reimbursed",
  cancelled: "Cancelled",
};

export function ExpenseDetailsPage({mode = "default",}: ExpenseDetailsPageProps) {

  const navigate = useNavigate();
  const { can } = usePermissions();

  const { id } = useParams<{
    id: string;
  }>();

  const {
    data: expense,
    isLoading,
    isError,
  } = useGetExpenseByIdQuery(id ?? "", {
    skip: !id,
  });

  const [
    submitExpense,
    {
      isLoading: isSubmitting,
      isError: isSubmitError,
    },
  ] = useSubmitExpenseMutation();

  const [
    rejectExpense,
    {
      isLoading: isRejecting,
      isError: isRejectError,
    },
  ] = useRejectExpenseMutation();

  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  const [rejectionReason, setRejectionReason] = useState("");

  const [
    approveExpense,
    {
      isLoading: isApproving,
      isError: isApproveError,
    },
  ] = useApproveExpenseMutation();

  const isReviewMode = mode === "review";

  if (!id) {
    return <ErrorState />;
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !expense) {
    return <ErrorState />;
  }

  const policyResult = evaluateExpensePolicy(expense);

  const handleSubmitExpense = async () => {
    try {
      await submitExpense(expense.id).unwrap();
    } catch {
      // Error is exposed through isSubmitError.
    }
  };

  const handleApproveExpense = async () => {
    try {
      await approveExpense(expense.id).unwrap();
    } catch {
      // Error is exposed through isApproveError.
    }
  };

  const handleRejectExpense = async () => {
    const reason = rejectionReason.trim();

    if (!reason) {
      return;
    }

    try {
      await rejectExpense({
        id: expense.id,
        reason,
      }).unwrap();

      setIsRejectDialogOpen(false);
      setRejectionReason("");
    } catch {
      // Error is exposed through isRejectError.
    }
  };

  const canEdit =
    !isReviewMode &&
    expense.status === "draft" &&
    can("expenses.update");

  const canSubmit =
    !isReviewMode &&
    expense.status === "draft" &&
    can("expenses.submit");

  const canApprove =
    isReviewMode &&
    expense.status === "under_review" &&
    can("expenses.approve") &&
    policyResult.allowed;

  const canReject =
    isReviewMode &&
    expense.status === "under_review" &&
    can("expenses.reject");

  return (
    <Stack spacing={3}>
      <Button
        variant="text"
        startIcon={<ArrowBackOutlined />}
        onClick={() => navigate(isReviewMode ? "/approvals" : "/expenses")}
        sx={{
          alignSelf: "flex-start",
        }}
      >
        Back
      </Button>

      {isSubmitError && (
        <Alert severity="error">
          Failed to submit expense.
        </Alert>
      )}

      {isApproveError && (
        <Alert severity="error">
          Failed to approve expense.
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Header */}
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            sx={{
              justifyContent: "space-between",
            }}
            spacing={2}
          >
            <Stack spacing={0.5}>
              <Typography variant="h5">
                {expense.title}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                {expense.category}
              </Typography>
            </Stack>

            <Chip
              label={statusLabels[expense.status]}
              size="small"
            />
          </Stack>

          {/* Actions */}
          {(canEdit ||
            canSubmit ||
            canApprove ||
            canReject) && (
            <Stack
              direction={{
                xs: "column",
                sm: "row",
              }}
              spacing={2}
            >
              {isReviewMode && expense.status === "under_review" && (
                  <Alert
                    severity={
                      policyResult.allowed
                        ? "success"
                        : "warning"
                    }
                  >
                    {policyResult.allowed
                      ? "This expense passes the current approval policy."
                      : policyResult.reason}
                  </Alert>
              )}
              
              {canEdit && (
                <Button
                  variant="contained"
                  onClick={() =>
                    navigate(
                      `/expenses/${expense.id}/edit`,
                    )
                  }
                >
                  Edit Expense
                </Button>
              )}

              {canSubmit && (
                <Button
                  variant="contained"
                  onClick={handleSubmitExpense}
                  loading={isSubmitting}
                >
                  Submit Expense
                </Button>
              )}

              {canApprove && (
                <Button
                  variant="contained"
                  onClick={handleApproveExpense}
                  loading={isApproving}
                >
                  Approve
                </Button>
              )}

              {canReject && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setIsRejectDialogOpen(true)}
                >
                  Reject
                </Button>
              )}
            </Stack>
          )}

          <Divider />

          {/* Financial information */}
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={4}
          >
            <Stack spacing={0.5}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Amount
              </Typography>

              <Typography variant="h6">
                {expense.currency}{" "}
                {expense.amount.toLocaleString()}
              </Typography>
            </Stack>

            <Stack spacing={0.5}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Expense Date
              </Typography>

              <Typography variant="body1">
                {expense.expenseDate}
              </Typography>
            </Stack>

            <Stack spacing={0.5}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Employee
              </Typography>

              <Typography variant="body1">
                {expense.employeeId}
              </Typography>
            </Stack>
          </Stack>

          <Divider />

          {/* Description */}
          <Stack spacing={1}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
              }}
            >
              Description
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
            >
              {expense.description}
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {/* Review-mode warning */}
      {isReviewMode &&
        expense.status !== "under_review" && (
          <Alert severity="info">
            This expense is not currently
            available for review.
          </Alert>
        )}
      
      <Dialog
        open={isRejectDialogOpen}
        onClose={() => {
          if (!isRejecting) {
            setIsRejectDialogOpen(false);
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Reject Expense
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Please provide a reason for rejecting this expense.
            </Typography>

            <TextField
              label="Rejection reason"
              placeholder="Enter the reason..."
              value={rejectionReason}
              onChange={(event) =>
                setRejectionReason(event.target.value)
              }
              multiline
              minRows={4}
              fullWidth
              required
              autoFocus
              disabled={isRejecting}
              error={
                rejectionReason.length > 0 &&
                rejectionReason.trim().length === 0
              }
              helperText="A rejection reason is required."
            />

            {isRejectError && (
              <Alert severity="error">
                Failed to reject the expense. Please try again.
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => setIsRejectDialogOpen(false)}
            disabled={isRejecting}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            color="error"
            onClick={handleRejectExpense}
            disabled={!rejectionReason.trim() || isRejecting}
            loading={isRejecting}
          >
            Reject Expense
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}