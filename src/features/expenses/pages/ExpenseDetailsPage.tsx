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
  useRestoreExpenseMutation,
  useStartReimbursementMutation,
  useReimburseExpenseMutation,
  useCancelExpenseMutation,
  useStartExpenseReviewMutation,
} from "../../../features/expenses/api/expenseApi";

import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { useAuth } from "../../../features/auth/context/AuthContext";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { useState } from "react";

import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { ForbiddenPage } from "../../auth/pages/ForbiddenPage";
import { isForbiddenError } from "../../auth/utils/authErrors";

import { EXPENSE_TYPE_LABELS, type ExpenseStatus } from "../types/expense";
import { isStatus } from "../../../services/api/apiErrors";
import { DocumentPanel } from "../../documents/components/DocumentPanel";

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
  const { user } = useAuth();

  const { id } = useParams<{
    id: string;
  }>();

  const {
    data: expense,
    error: expenseError,
    isLoading,
    isError,
  } = useGetExpenseByIdQuery(id ?? "", {
    skip: !id,
  });

  const [
    submitExpense,
    {
      isLoading: isSubmitting,
      error: submitError,
    },
  ] = useSubmitExpenseMutation();

  const [
    rejectExpense,
    {
      isLoading: isRejecting,
      error: rejectError,
    },
  ] = useRejectExpenseMutation();

  const [
    startExpenseReview,
    { isLoading: isStartingReview, error: startReviewError },
  ] = useStartExpenseReviewMutation();

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  const [rejectionReason, setRejectionReason] = useState("");

  const [
    approveExpense,
    {
      isLoading: isApproving,
      error: approveError,
    },
  ] = useApproveExpenseMutation();

  const [restoreExpense, { isLoading: isRestoring, error: restoreError }] =
    useRestoreExpenseMutation();

  const [
    startReimbursement,
    { isLoading: isStartingReimbursement, error: startReimbursementError },
  ] = useStartReimbursementMutation();

  const [reimburseExpense, { isLoading: isReimbursing, error: reimburseError }] =
    useReimburseExpenseMutation();

  const [cancelExpense, { isLoading: isCancelling, error: cancelError }] =
    useCancelExpenseMutation();

  const mutationError =
    submitError ??
    startReviewError ??
    approveError ??
    restoreError ??
    startReimbursementError ??
    reimburseError ??
    cancelError;

  const isReviewMode = mode === "review";

  if (!id) {
    return <ErrorState />;
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !expense) {
    if (isForbiddenError(expenseError)) {
      return <ForbiddenPage />;
    }

    if (isStatus(expenseError, 404)) {
      return <ErrorState message="This expense does not exist or is not available to you." />;
    }

    return <ErrorState />;
  }

  const policyResult = expense.policyEvaluation;

  const handleSubmitExpense = async () => {
    try {
      await submitExpense(expense.id).unwrap();
    } catch {
      // Error is exposed through isSubmitError.
    }
  };

  const handleStartReview = async () => {
    try {
      await startExpenseReview(expense.id).unwrap();
    } catch {
      // Error is exposed through startReviewError.
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

  const handleRestoreExpense = async () => {
    try {
      await restoreExpense(expense.id).unwrap();
    } catch {
      // Error is exposed through isRestoreError.
    }
  };

  const handleStartReimbursement = async () => {
    try {
      await startReimbursement(expense.id).unwrap();
    } catch {
      // Error is exposed through isStartReimbursementError.
    }
  };

  const handleReimburseExpense = async () => {
    try {
      await reimburseExpense(expense.id).unwrap();
    } catch {
      // Error is exposed through isReimburseError.
    }
  };

  const handleCancelExpense = async () => {
    try {
      await cancelExpense(expense.id).unwrap();
    } catch {
      // Error is exposed through cancelError.
    } finally {
      setIsCancelDialogOpen(false);
    }
  };

  // Draft and rejected expenses can only be changed by their owner (§13).
  const isOwner = Boolean(user) && expense.employeeId === user?.id;

  const canEdit =
    !isReviewMode &&
    isOwner &&
    expense.status === "draft" &&
    can("expenses.update");

  const canSubmit =
    !isReviewMode &&
    isOwner &&
    expense.status === "draft" &&
    can("expenses.submit");

  // Only administrators may review their own expenses.
  const canReviewThis = !isOwner || user?.role === "admin";

  const canStartReview =
    isReviewMode &&
    canReviewThis &&
    expense.status === "submitted" &&
    can("expenses.approve");

  const canApprove =
    isReviewMode &&
    canReviewThis &&
    expense.status === "under_review" &&
    can("expenses.approve");

  const canReject =
    isReviewMode &&
    canReviewThis &&
    expense.status === "under_review" &&
    can("expenses.reject");

  const canRestore =
    !isReviewMode &&
    isOwner &&
    expense.status === "rejected" &&
    can("expenses.update");

  const canStartReimbursement =
    !isReviewMode &&
    expense.status === "approved" &&
    can("reimbursements.manage");

  const canReimburse =
    !isReviewMode &&
    expense.status === "reimbursement_pending" &&
    can("reimbursements.manage");

  const canCancel =
    !isReviewMode &&
    ((expense.status === "draft" && isOwner && can("expenses.update")) ||
      ((expense.status === "approved" ||
        expense.status === "reimbursement_pending") &&
        can("reimbursements.manage")));

  const canManageDocuments =
    !isReviewMode &&
    isOwner &&
    expense.status === "draft" &&
    can("documents.create") &&
    can("documents.delete");

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

      {mutationError && <ApiFeedback error={mutationError} />}

      {expense.rejectionReason &&
        (expense.status === "rejected" || expense.status === "draft") && (
          <Alert severity="warning">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {expense.status === "rejected" ? "Rejection reason" : "Previously rejected"}
            </Typography>
            <Typography variant="body2">{expense.rejectionReason}</Typography>
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
                {EXPENSE_TYPE_LABELS[expense.type] ?? expense.type}
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
            canStartReview ||
            canApprove ||
            canReject ||
            canRestore ||
            canStartReimbursement ||
            canReimburse ||
            canCancel) && (
            <Stack
              direction={{
                xs: "column",
                sm: "row",
              }}
              spacing={2}
            >
              {isReviewMode &&
                expense.status === "under_review" &&
                policyResult && (
                  <Alert
                    severity={
                      policyResult.result === "COMPLIANT" ||
                      policyResult.result === "REQUIRES_APPROVAL" ||
                      policyResult.result === "NO_APPLICABLE_POLICY"
                        ? "success"
                        : "warning"
                    }
                  >
                    <Stack spacing={0.5}>
                      <Typography variant="body2">
                        Policy result: {policyResult.result.replaceAll("_", " ")}
                      </Typography>
                      {policyResult.details.violatedRules?.map((rule) => (
                        <Typography key={rule} variant="body2">
                          {rule}
                        </Typography>
                      ))}
                      {policyResult.details.missingInformation?.map((item) => (
                        <Typography key={item} variant="body2">
                          {item}
                        </Typography>
                      ))}
                    </Stack>
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

              {canStartReview && (
                <Button
                  variant="contained"
                  onClick={handleStartReview}
                  loading={isStartingReview}
                >
                  Start Review
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

              {canRestore && (
                <Button
                  variant="outlined"
                  onClick={handleRestoreExpense}
                  loading={isRestoring}
                >
                  Restore to Draft
                </Button>
              )}

              {canStartReimbursement && (
                <Button
                  variant="contained"
                  onClick={handleStartReimbursement}
                  loading={isStartingReimbursement}
                >
                  Start Reimbursement
                </Button>
              )}

              {canReimburse && (
                <Button
                  variant="contained"
                  onClick={handleReimburseExpense}
                  loading={isReimbursing}
                >
                  Mark Reimbursed
                </Button>
              )}

              {canCancel && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setIsCancelDialogOpen(true)}
                  disabled={isCancelling}
                >
                  Cancel Expense
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
                {expense.employeeName ?? expense.employeeId}
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
        expense.status !== "under_review" &&
        expense.status !== "submitted" && (
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

            {rejectError && <ApiFeedback error={rejectError} />}
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
      <ConfirmDialog
        open={isCancelDialogOpen}
        title="Cancel expense"
        message="Cancelling keeps the expense as a historical record, but it can no longer be submitted or processed. Continue?"
        confirmLabel="Cancel expense"
        cancelLabel="Keep expense"
        loadingLabel="Cancelling..."
        loading={isCancelling}
        onConfirm={handleCancelExpense}
        onCancel={() => setIsCancelDialogOpen(false)}
      />
      <DocumentPanel expenseId={expense.id} canManage={canManageDocuments} />
    </Stack>
  );
}