import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowBackOutlined } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

import { useCreateExpenseMutation } from "../api/expenseApi";
import { ReceiptUpload } from "../components/ReceiptUpload";

interface ExpenseFormData {
  title: string;
  description: string;
  amount: string;
  category: string;
  expenseDate: string;
}

const initialFormData: ExpenseFormData = {
  title: "",
  description: "",
  amount: "",
  category: "",
  expenseDate: "",
};

export function CreateExpensePage() {

  const [receipt, setReceipt] = useState<File | null>(null);
  const navigate = useNavigate();

  const [formData, setFormData] =
    useState<ExpenseFormData>(initialFormData);

  const [
    createExpense,
    {
      isLoading,
      isError,
    },
  ] = useCreateExpenseMutation();

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>,
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

    const createdExpense = await createExpense({
      title: formData.title.trim(),
      description: formData.description.trim(),
      amount: Number(formData.amount),
      currency: "INR",
      category: formData.category.trim(),
      expenseDate: formData.expenseDate,
    }).unwrap();

    navigate(`/expenses/${createdExpense.id}`);
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction={"row"}
        sx={{justifyContent: "flex-start", alignItems: "center"}}
      >
        <Button
          variant="text"
          startIcon={<ArrowBackOutlined />}
          onClick={() => navigate(-1)}
        >
          Back to Expenses
        </Button>
      </Stack>

      <Typography variant="h4">
        Create Expense
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack
          component="form"
          spacing={3}
          onSubmit={handleSubmit}
        >
          {isError && (
            <Alert severity="error">
              Failed to create expense.
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

          <ReceiptUpload
            value={receipt}
            onChange={setReceipt}
          />

          <Stack
            direction="row"
            sx={{justifyContent: "flex-end"}}
            spacing={2}
          >
            <Button
              variant="outlined"
              onClick={() => navigate("/expenses")}
              disabled={isLoading}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="contained"
              loading={isLoading}
            >
              Create Expense
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}