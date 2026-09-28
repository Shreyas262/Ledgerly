import { ExpensePolicyPreview } from "../../policies/components/ExpensePolicyPreview";
import { useConfirm } from "../../../components/common/ConfirmProvider";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  Alert,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
} from "@mui/material";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  useGetExpenseByIdQuery,
  useUpdateExpenseMutation,
} from "../api/expenseApi";

import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { ForbiddenPage } from "../../auth/pages/ForbiddenPage";
import { isForbiddenError } from "../../auth/utils/authErrors";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { getApiErrorDetails, isStatus } from "../../../services/api/apiErrors";

import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS, type ExpenseType } from "../types/expense";
import { PageHeader } from "../../../components/common/PageHeader";
import { BackLink } from "../../../components/navigation/BackLink";

interface ExpenseFormData {
  type: ExpenseType;
  title: string;
  description: string;
  amount: string;
  expenseDate: string;
}

const emptyForm: ExpenseFormData = {
  type: "OTHER",
  title: "",
  description: "",
  amount: "",
  expenseDate: "",
};

export function EditExpensePage() {
  const navigate = useNavigate();

  const { id } = useParams<{
    id: string;
  }>();

  const { can } = usePermissions();
  const confirm = useConfirm();

  const {
    data: expense,
    error: expenseError,
    isLoading: isExpenseLoading,
    isError: isExpenseError,
    refetch: refetchExpense,
  } = useGetExpenseByIdQuery(id ?? "");

  const [
    updateExpense,
    {
      isLoading: isUpdating,
      isError: isUpdateError,
      error: updateError,
    },
  ] = useUpdateExpenseMutation();

  const [formData, setFormData] =
    useState<ExpenseFormData>(emptyForm);

  const updateDetails = getApiErrorDetails(updateError);

  useEffect(() => {
    if (!expense) {
      return;
    }

    setFormData({
      type: expense.type,
      title: expense.title,
      description: expense.description,
      amount: String(expense.amount),
      expenseDate: expense.expenseDate,
    });
  }, [expense]);

  if (!id) {
    return <ErrorState title="Not found" message="No expense was specified." />;
  }

  if (!can("expenses.update")) {
    return <ErrorState title="Access denied" message="You do not have permission to edit expenses." />;
  }

  if (isExpenseLoading) {
    return <LoadingState />;
  }

  if (isExpenseError || !expense) {
    if (isForbiddenError(expenseError)) {
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

  const handleChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!(await confirm({ title: "Save Changes", message: "Save your changes to this expense?", confirmLabel: "Save" }))) return;

    try {
      const updatedExpense =
        await updateExpense({
          id: expense.id,
          type: formData.type,
          title: formData.title.trim(),
          description: formData.description.trim(),
          amount: Number(formData.amount),
          currency: "INR",
          expenseDate: formData.expenseDate,
        }).unwrap();

      navigate(`/expenses/${updatedExpense.id}`);
    } catch {
      // Preserve local form state after server failure.
    }
  };

  return (
    <Stack spacing={3}>
      <BackLink to={`/expenses/${expense.id}`} label="Expense" />

      <PageHeader title="Edit Expense" />

      <Paper sx={{ p: 3 }}>
        <Stack
          component="form"
          spacing={3}
          onSubmit={handleSubmit}
        >
          {isUpdateError && <ApiFeedback error={updateError} onReconcile={isStatus(updateError, 409) ? () => refetchExpense() : undefined} />}

          <FormControl fullWidth required>
            <InputLabel id="expense-type-label">Expense Type</InputLabel>
            <Select
              labelId="expense-type-label"
              label="Expense Type"
              value={formData.type}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  type: event.target.value as ExpenseType,
                }))
              }
            >
              {EXPENSE_TYPES.map((value) => (
                <MenuItem key={value} value={value}>
                  {EXPENSE_TYPE_LABELS[value]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Title"
            name="title"
            value={formData.title}
            error={Boolean(updateDetails.fieldErrors?.title)}
            helperText={updateDetails.fieldErrors?.title?.toString()}
            onChange={handleChange}
            required
            fullWidth
          />

          <TextField
            label="Description"
            name="description"
            value={formData.description}
            error={Boolean(updateDetails.fieldErrors?.description)}
            helperText={updateDetails.fieldErrors?.description?.toString()}
            onChange={handleChange}
            multiline
            rows={4}
            required
            fullWidth
          />

          <TextField
            label="Amount"
            name="amount"
            type="number"
            value={formData.amount}
            error={Boolean(updateDetails.fieldErrors?.amount)}
            helperText={updateDetails.fieldErrors?.amount?.toString()}
            onChange={handleChange}
            required
            fullWidth
            slotProps={{
              htmlInput: {
                min: 0,
                step: "0.01",
              },
            }}
          />

          <TextField
            label="Expense Date"
            name="expenseDate"
            type="date"
            value={formData.expenseDate}
            error={Boolean(updateDetails.fieldErrors?.expenseDate)}
            helperText={updateDetails.fieldErrors?.expenseDate?.toString()}
            onChange={handleChange}
            required
            fullWidth
            slotProps={{
              inputLabel: {
                shrink: true,
              },
            }}
          />

          <ExpensePolicyPreview
            type={formData.type}
            amount={formData.amount}
            expenseDate={formData.expenseDate}
            description={formData.description}
            expenseId={expense.id}
          />

          <Stack
            direction="row"
            sx={{justifyContent: "flex-end"}}
            spacing={2}
          >
            <Button
              variant="outlined"
              onClick={() =>
                navigate(`/expenses/${expense.id}`)
              }
              disabled={isUpdating}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="contained"
              loading={isUpdating}
            >
              Save Changes
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}