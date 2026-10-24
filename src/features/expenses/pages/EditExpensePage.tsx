import { useState, type FormEvent } from "react";
import { Alert, Button, Paper, Stack } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";

import { ExpensePolicyPreview } from "../../policies/components/ExpensePolicyPreview";
import { ForbiddenPage } from "../../auth/pages/ForbiddenPage";
import { useRupeeEstimate } from "../../currency/hooks/useRupeeEstimate";
import { useGetExpenseByIdQuery, useUpdateExpenseMutation } from "../api/expenseApi";
import { ExpenseFormFields } from "../components/ExpenseFormFields";
import { isExpenseFormComplete, toExpenseForm, toExpenseRequest, type ExpenseFormData } from "../utils/expenseForm";
import type { Expense } from "../types/expense";
import { useConfirm } from "../../../components/common/useConfirm";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { PageHeader } from "../../../components/common/PageHeader";
import { BackLink } from "../../../components/navigation/BackLink";
import { getApiErrorDetails, isStatus } from "../../../services/api/apiErrors";

export function EditExpensePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const confirm = useConfirm();

  const {
    data: expense,
    error: expenseError,
    isLoading: isExpenseLoading,
    isError: isExpenseError,
    refetch: refetchExpense,
  } = useGetExpenseByIdQuery(id ?? "", { skip: !id });

  const [updateExpense, { isLoading: isUpdating, error: updateError }] = useUpdateExpenseMutation();

  if (!id) {
    return <ErrorState title="Not found" message="No expense was specified." />;
  }

  if (isExpenseLoading) {
    return <LoadingState />;
  }

  if (isExpenseError || !expense) {
    if (isStatus(expenseError, 403)) {
      return <ForbiddenPage />;
    }

    if (isStatus(expenseError, 404)) {
      return <ErrorState message="This expense does not exist or is not available to you." />;
    }

    return <ErrorState error={expenseError} onRetry={refetchExpense} />;
  }

  if (expense.status !== "draft") {
    return (
      <Stack spacing={3}>
        <BackLink to={`/expenses/${expense.id}`} label="Expense" />

        <Alert severity="warning">
          Only draft expenses can be edited.
        </Alert>
      </Stack>
    );
  }

  const handleSubmit = async (formData: ExpenseFormData) => {
    if (!isExpenseFormComplete(formData)) return;
    if (!(await confirm({ title: "Save Changes", message: "Save your changes to this expense?", confirmLabel: "Save" }))) return;

    try {
      const updatedExpense = await updateExpense({ id: expense.id, ...toExpenseRequest(formData) }).unwrap();
      navigate(`/expenses/${updatedExpense.id}`);
    } catch {
      // Preserve local form state after server failure.
    }
  };

  return (
    <Stack spacing={3}>
      <BackLink to={`/expenses/${expense.id}`} label="Expense" />

      <PageHeader title="Edit Expense" />

      {/* A newer version of the expense starts the form again from its values. */}
      <EditExpenseForm
        key={`${expense.id}:${expense.updatedAt}`}
        expense={expense}
        isSubmitting={isUpdating}
        error={updateError}
        onReconcile={() => refetchExpense()}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/expenses/${expense.id}`)}
      />
    </Stack>
  );
}

interface EditExpenseFormProps {
  expense: Expense;
  isSubmitting: boolean;
  error: unknown;
  onReconcile: () => void;
  onSubmit: (formData: ExpenseFormData) => void;
  onCancel: () => void;
}

function EditExpenseForm({ expense, isSubmitting, error, onReconcile, onSubmit, onCancel }: EditExpenseFormProps) {
  const [formData, setFormData] = useState<ExpenseFormData>(() => toExpenseForm(expense));
  // Policies apply to the rupee amount.
  const estimate = useRupeeEstimate(formData.amount, formData.currency, formData.expenseDate);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(formData);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack component="form" spacing={3} onSubmit={handleSubmit}>
        {error ? <ApiFeedback error={error} onReconcile={isStatus(error, 409) ? onReconcile : undefined} /> : null}

        <ExpenseFormFields
          value={formData}
          onChange={setFormData}
          fieldErrors={getApiErrorDetails(error).fieldErrors}
        />

        <ExpensePolicyPreview
          type={formData.type}
          amount={estimate.rupees === undefined ? "" : String(estimate.rupees)}
          expenseDate={formData.expenseDate}
          description={formData.description}
          expenseId={expense.id}
        />

        <Stack direction="row" sx={{ justifyContent: "flex-end" }} spacing={2}>
          <Button variant="outlined" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>

          <Button type="submit" variant="contained" loading={isSubmitting}>
            Save Changes
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
