import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Grid,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { DeleteOutlineOutlined, EditOutlined } from "@mui/icons-material";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";

import { PageHeader } from "../../../components/common/PageHeader";
import { BackLink } from "../../../components/navigation/BackLink";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { useConfirm } from "../../../components/common/ConfirmProvider";
import { formatCurrency } from "../../../utils/currency";
import { formatDate, formatDateTime } from "../../../utils/format";
import { useDeletePersonalExpenseMutation, useGetPersonalExpenseQuery } from "../api/personalApi";
import { PAYMENT_METHOD_LABELS, PERSONAL_EXPENSE_TYPE_LABELS } from "../types/personal";
import { PersonalReceiptPanel } from "../components/PersonalReceiptPanel";

interface LocationState {
  notice?: string;
  receiptError?: string;
}

export function PersonalExpenseDetailsPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const state = (location.state as LocationState | null) ?? {};
  const [notice, setNotice] = useState<string | null>(state.notice ?? null);
  const [receiptError, setReceiptError] = useState<string | null>(state.receiptError ?? null);

  const { data: expense, isLoading, isError, error, refetch } = useGetPersonalExpenseQuery(id);
  const [deleteExpense, { isLoading: isDeleting, error: deleteError }] = useDeletePersonalExpenseMutation();

  if (isLoading) return <LoadingState message="Loading expense…" />;
  if (isError || !expense) {
    return (
      <Stack spacing={3}>
        <BackLink to="/personal/expenses" label="Expenses" />
        <ErrorState error={error} onRetry={refetch} />
      </Stack>
    );
  }

  const handleDelete = async () => {
    const receipts = expense.documentIds.length;
    if (!(await confirm({
      title: "Delete Expense",
      message: `Delete "${expense.description}" (${formatCurrency(expense.amount)})${receipts ? ` and its ${receipts} ${receipts === 1 ? "receipt" : "receipts"}` : ""}? This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    }))) return;
    try {
      await deleteExpense(expense.id).unwrap();
      navigate("/personal/expenses", { replace: true, state: { notice: "Expense deleted." } });
    } catch {
      // The reason is shown below the header.
    }
  };

  return (
    <Stack spacing={3}>
      <BackLink to="/personal/expenses" label="Expenses" />
      <PageHeader
        title={formatCurrency(expense.amount)}
        description={expense.description}
        chips={<Chip size="small" label={PERSONAL_EXPENSE_TYPE_LABELS[expense.type]} />}
        actions={
          <>
            <Button component={RouterLink} to={`/personal/expenses/${expense.id}/edit`} variant="outlined" startIcon={<EditOutlined />}>
              Edit
            </Button>
            <Button color="error" variant="outlined" startIcon={<DeleteOutlineOutlined />} onClick={handleDelete} loading={isDeleting}>
              Delete
            </Button>
          </>
        }
      />

      {deleteError && <ApiFeedback error={deleteError} />}
      {receiptError && <Alert severity="warning" onClose={() => setReceiptError(null)}>{receiptError}</Alert>}

      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Grid container spacing={2.5}>
          <Detail label="Amount" value={formatCurrency(expense.amount)} />
          <Detail label="Date" value={formatDate(expense.expenseDate)} />
          <Detail label="Type" value={PERSONAL_EXPENSE_TYPE_LABELS[expense.type]} />
          <Detail label="Payment method" value={PAYMENT_METHOD_LABELS[expense.paymentMethod]} />
          <Detail label="Description" value={expense.description} wide />
          <Detail label="Recorded" value={formatDateTime(expense.createdAt)} />
          <Detail label="Last updated" value={formatDateTime(expense.updatedAt)} />
        </Grid>
      </Paper>

      <PersonalReceiptPanel expenseId={expense.id} />

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={3000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setNotice(null)}>{notice}</Alert>
      </Snackbar>
    </Stack>
  );
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <Grid size={{ xs: 12, sm: wide ? 12 : 6 }}>
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography sx={{ overflowWrap: "anywhere", whiteSpace: "pre-line" }}>{value}</Typography>
      </Stack>
    </Grid>
  );
}
