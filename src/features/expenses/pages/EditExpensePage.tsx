import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  ArrowBackOutlined,
} from "@mui/icons-material";

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

import { usePermissions } from "../../../features/auth/hooks/usePermissions";

interface ExpenseFormData {
  title: string;
  description: string;
  amount: string;
  category: string;
  expenseDate: string;
}

const emptyForm: ExpenseFormData = {
  title: "",
  description: "",
  amount: "",
  category: "",
  expenseDate: "",
};

export function EditExpensePage() {
  const navigate = useNavigate();

  const { id } = useParams<{
    id: string;
  }>();

  const { can } = usePermissions();

  const {
    data: expense,
    isLoading: isExpenseLoading,
    isError: isExpenseError,
  } = useGetExpenseByIdQuery(id ?? "");

  const [
    updateExpense,
    {
      isLoading: isUpdating,
      isError: isUpdateError,
    },
  ] = useUpdateExpenseMutation();

  const [formData, setFormData] =
    useState<ExpenseFormData>(emptyForm);

  useEffect(() => {
    if (!expense) {
      return;
    }

    setFormData({
      title: expense.title,
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category,
      expenseDate: expense.expenseDate,
    });
  }, [expense]);

  if (!id) {
    return <ErrorState />;
  }

  if (!can("expenses.update")) {
    return <ErrorState />;
  }

  if (isExpenseLoading) {
    return <LoadingState />;
  }

  if (isExpenseError || !expense) {
    return <ErrorState />;
  }

  if (expense.status !== "draft") {
    return (
      <Stack spacing={3}>
        <Button
          variant="text"
          startIcon={<ArrowBackOutlined />}
          onClick={() =>
            navigate(`/expenses/${expense.id}`)
          }
        >
          Back to Expense
        </Button>

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

    try {
      const updatedExpense =
        await updateExpense({
          id: expense.id,
          title: formData.title.trim(),
          description: formData.description.trim(),
          amount: Number(formData.amount),
          currency: "INR",
          category: formData.category.trim(),
          expenseDate: formData.expenseDate,
        }).unwrap();

      navigate(`/expenses/${updatedExpense.id}`);
    } catch {
      // RTK Query exposes the mutation error through isUpdateError.
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{justifyContent: "flex-start"}}>
      <Button
        variant="text"
        startIcon={<ArrowBackOutlined />}
        onClick={() =>
          navigate(`/expenses/${expense.id}`)
        }
      >
        Back to Expense
      </Button>
      </Stack>

      <Typography variant="h4">
        Edit Expense
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack
          component="form"
          spacing={3}
          onSubmit={handleSubmit}
        >
          {isUpdateError && (
            <Alert severity="error">
              Failed to update expense.
            </Alert>
          )}

          <TextField
            label="Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            fullWidth
          />

          <TextField
            label="Description"
            name="description"
            value={formData.description}
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
            label="Category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            fullWidth
          />

          <TextField
            label="Expense Date"
            name="expenseDate"
            type="date"
            value={formData.expenseDate}
            onChange={handleChange}
            required
            fullWidth
            slotProps={{
              inputLabel: {
                shrink: true,
              },
            }}
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