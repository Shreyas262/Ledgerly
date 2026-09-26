import { useConfirm } from "../../../components/common/ConfirmProvider";
import { useState, type FormEvent } from "react";
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowBackOutlined } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useCreateExpenseMutation } from "../api/expenseApi";
import { useGetActiveBudgetPeriodQuery } from "../../budgets/api/budgetsApi";
import { Alert } from "@mui/material";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { getApiErrorDetails } from "../../../services/api/apiErrors";
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS, type ExpenseType } from "../types/expense";

interface ExpenseFormData {
  type: ExpenseType;
  title: string;
  description: string;
  amount: string;
  expenseDate: string;
}

const initialFormData: ExpenseFormData = {
  type: "OTHER",
  title: "",
  description: "",
  amount: "",
  expenseDate: "",
};

export function CreateExpensePage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [formData, setFormData] = useState<ExpenseFormData>(initialFormData);

  const [createExpense, { isLoading, error }] = useCreateExpenseMutation();
  const { data: eligibility } = useGetActiveBudgetPeriodQuery(undefined, { refetchOnMountOrArgChange: true });
  const activePeriod = eligibility?.period;
  const creationBlocked = eligibility ? !eligibility.canCreateExpense : false;
  const details = getApiErrorDetails(error);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.title.trim() || !formData.description.trim() || !formData.amount || !formData.expenseDate) {
      return;
    }

    if (!Number.isFinite(Number(formData.amount)) || Number(formData.amount) <= 0) {
      return;
    }

    if (!(await confirm({ title: "Create expense", message: `Create "${formData.title.trim()}" for ₹${Number(formData.amount).toLocaleString("en-IN")} as a draft?`, confirmLabel: "Create" }))) return;

    try {
      const createdExpense = await createExpense({
      type: formData.type,
      title: formData.title.trim(),
      description: formData.description.trim(),
      amount: Number(formData.amount),
      currency: "INR",
      expenseDate: formData.expenseDate,
      }).unwrap();

      navigate(`/expenses/${createdExpense.id}`);
    } catch {
      // Preserve form input so the user can correct or retry after a server failure.
    }
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction={"row"}
        sx={{ justifyContent: "flex-start", alignItems: "center" }}
      >
        <Button
          variant="text"
          startIcon={<ArrowBackOutlined />}
          onClick={() => navigate(-1)}
        >
          Back to Expenses
        </Button>
      </Stack>

      <Typography variant="h4">Create Expense</Typography>

      {creationBlocked && (
        <Alert severity="warning">
          {eligibility?.reason}
        </Alert>
      )}
      {activePeriod && (
        <Alert severity="info">
          The expense date must fall within the active budget period ({activePeriod.startDate} to {activePeriod.endDate}).
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stack component="form" spacing={3} onSubmit={handleSubmit}>
          {error && <ApiFeedback error={error} />}

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
            error={Boolean(details.fieldErrors?.title)}
            helperText={details.fieldErrors?.title?.toString()}
            onChange={handleChange}
            required
            fullWidth
          />

          <TextField
            label="Description"
            name="description"
            value={formData.description}
            error={Boolean(details.fieldErrors?.description)}
            helperText={details.fieldErrors?.description?.toString()}
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
            error={Boolean(details.fieldErrors?.amount)}
            helperText={details.fieldErrors?.amount?.toString()}
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
            error={Boolean(details.fieldErrors?.expenseDate)}
            helperText={details.fieldErrors?.expenseDate?.toString()}
            onChange={handleChange}
            required
            fullWidth
            slotProps={{
              inputLabel: {
                shrink: true,
              },
              htmlInput: activePeriod ? { min: activePeriod.startDate, max: activePeriod.endDate } : undefined,
            }}
          />

          <Stack
            direction="row"
            sx={{ justifyContent: "flex-end" }}
            spacing={2}
          >
            <Button
              variant="outlined"
              onClick={() => navigate("/expenses")}
              disabled={isLoading}
            >
              Cancel
            </Button>

            <Button type="submit" variant="contained" loading={isLoading} disabled={creationBlocked}>
              Create Expense
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
