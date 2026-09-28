import { useConfirm } from "../../../components/common/ConfirmProvider";
import { formatCurrency } from "../../../utils/currency";
import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Card,
  CardContent,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useGetReimbursementQueueQuery } from "../api/reimbursementApi";
import {
  useCancelExpenseMutation,
  useReimburseExpenseMutation,
  useStartReimbursementMutation,
} from "../../expenses/api/expenseApi";
import {
  EXPENSE_TYPE_LABELS,
  type Expense,
  type ExpenseStatus,
} from "../../expenses/types/expense";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { useAuth } from "../../auth/context/AuthContext";
import { Amount } from "../../../components/common/Amount";

type ReimbursementView = Extract<
  ExpenseStatus,
  "approved" | "reimbursement_pending" | "reimbursed" | "cancelled"
>;

const views: Record<ReimbursementView, { label: string; chip: string; empty: string }> = {
  approved: {
    label: "To Process",
    chip: "Approved",
    empty: "There are no approved expenses waiting for reimbursement.",
  },
  reimbursement_pending: {
    label: "In Progress",
    chip: "Processing",
    empty: "There are no reimbursements in progress.",
  },
  reimbursed: {
    label: "Reimbursed",
    chip: "Reimbursed",
    empty: "No expenses have been reimbursed yet.",
  },
  cancelled: {
    label: "Cancelled",
    chip: "Cancelled",
    empty: "No expenses have been cancelled during financial processing.",
  },
};

/**
 * Finance processing of approved expenses (§22.7–22.11): start and complete
 * reimbursement, or cancel with a reason. Scope is enforced by the API.
 */
export function ReimbursementQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [view, setView] = useState<ReimbursementView>("approved");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [cancellingExpense, setCancellingExpense] = useState<Expense | null>(null);

  const {
    currentData: expenses,
    isFetching,
    isError,
    error: loadError,
    refetch,
  } = useGetReimbursementQueueQuery({
    filter: { status: view },
    sort: "updatedAt",
    sortOrder: "desc",
  });

  const [startReimbursement, { error: startError }] = useStartReimbursementMutation();
  const [reimburseExpense, { error: reimburseError }] = useReimburseExpenseMutation();
  const [cancelExpense, { isLoading: isCancelling, error: cancelError }] =
    useCancelExpenseMutation();
  const mutationError = startError ?? reimburseError ?? cancelError;

  const runAction = async (expenseId: string, action: () => Promise<unknown>) => {
    setProcessingId(expenseId);
    try {
      await action();
    } catch {
      // Error is exposed through the mutation state.
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (reason?: string) => {
    if (!cancellingExpense) return;
    const expenseId = cancellingExpense.id;
    setCancellingExpense(null);
    await runAction(expenseId, () => cancelExpense({ id: expenseId, reason }).unwrap());
  };

  return (
    <Stack spacing={3}>
      <Typography color="text.secondary">
        Approved expenses within your reimbursement scope.
      </Typography>

      <Tabs
        value={view}
        onChange={(_event, nextView: ReimbursementView) => setView(nextView)}
        aria-label="Reimbursement status"
        variant="scrollable"
        allowScrollButtonsMobile
        textColor="secondary"
        indicatorColor="secondary"
      >
        {(Object.keys(views) as ReimbursementView[]).map((status) => (
          <Tab key={status} value={status} label={views[status].label} />
        ))}
      </Tabs>

      {mutationError && <ApiFeedback error={mutationError} />}

      {isFetching && !expenses ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={loadError} onRetry={refetch} />
      ) : !expenses?.length ? (
        <Alert severity="info">{views[view].empty}</Alert>
      ) : (
        <Stack spacing={2}>
          {expenses.map((expense) => {
            const isProcessing = processingId === expense.id;
            // Separation of duties: Finance cannot reimburse what it approved.
            const approvedBySelf = user?.role === "finance" && expense.approvedBy === user.id;
            const canCancel =
              expense.status === "approved" ||
              expense.status === "reimbursement_pending";

            return (
              <Card key={expense.id}>
                <CardContent>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ justifyContent: "space-between" }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1">
                      {expense.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {EXPENSE_TYPE_LABELS[expense.type] ?? expense.type} · Employee:{" "}
                      {expense.employeeName ?? expense.employeeId}
                      {expense.employeeRemoved ? " (removed)" : ""}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {expense.teamName ?? expense.teamId} · {expense.departmentName ?? expense.departmentId}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Amount:{" "}
                      <Amount value={expense.amount} currency={expense.currency} />
                    </Typography>
                    {expense.status === "cancelled" && expense.cancellationReason && (
                      <Typography variant="body2" color="text.secondary">
                        Reason: {expense.cancellationReason}
                      </Typography>
                    )}
                    <Chip
                      size="small"
                      label={views[view].chip}
                      sx={{ alignSelf: "flex-start" }}
                    />
                  </Stack>

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
                  >
                    <Button
                      variant="outlined"
                      onClick={() => navigate(`/expenses/${expense.id}`)}
                    >
                      View
                    </Button>

                    {approvedBySelf && (expense.status === "approved" || expense.status === "reimbursement_pending") && (
                      <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                        You approved this expense; another user must reimburse it.
                      </Typography>
                    )}

                    {!approvedBySelf && expense.status === "approved" && (
                      <Button
                        variant="contained"
                        loading={isProcessing}
                        disabled={Boolean(processingId) && !isProcessing}
                        onClick={() =>
                          confirm({ title: "Start Reimbursement", message: `Start reimbursing "${expense.title}"?`, confirmLabel: "Start" })
                            .then((ok) => { if (ok) void runAction(expense.id, () => startReimbursement(expense.id).unwrap()); })
                        }
                      >
                        Start Reimbursement
                      </Button>
                    )}

                    {!approvedBySelf && expense.status === "reimbursement_pending" && (
                      <Button
                        variant="contained"
                        loading={isProcessing}
                        disabled={Boolean(processingId) && !isProcessing}
                        onClick={() =>
                          confirm({ title: "Mark as Reimbursed", message: `Confirm that ${formatCurrency(expense.amount)} has been paid for "${expense.title}"? This cannot be undone.`, confirmLabel: "Mark Reimbursed" })
                            .then((ok) => { if (ok) void runAction(expense.id, () => reimburseExpense(expense.id).unwrap()); })
                        }
                      >
                        Mark Reimbursed
                      </Button>
                    )}

                    {canCancel && (
                      <Button
                        variant="outlined"
                        color="error"
                        disabled={Boolean(processingId)}
                        onClick={() => setCancellingExpense(expense)}
                      >
                        Cancel
                      </Button>
                    )}
                  </Stack>
                </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <ConfirmDialog
        open={Boolean(cancellingExpense)}
        title="Cancel Expense"
        message={`Cancel "${cancellingExpense?.title ?? ""}"? It stays as a historical record but will not be reimbursed.`}
        confirmLabel="Cancel Expense"
        cancelLabel="Keep Expense"
        loadingLabel="Cancelling…"
        loading={isCancelling}
        reasonLabel="Cancellation reason"
        onConfirm={handleCancel}
        onCancel={() => setCancellingExpense(null)}
      />
    </Stack>
  );
}
