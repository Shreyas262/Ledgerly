import type { ChangeEvent } from "react";
import { FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material";

import type { ApiErrorDetails } from "../../../services/api/apiErrors";
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS, type ExpenseType } from "../types/expense";
import type { ExpenseFormData } from "../utils/expenseForm";

interface ExpenseFormFieldsProps {
  value: ExpenseFormData;
  onChange: (next: ExpenseFormData) => void;
  /** Field-level reasons returned by the API. */
  fieldErrors?: ApiErrorDetails["fieldErrors"];
  /** Allowed expense dates, when a budget period limits them. */
  dateRange?: { min: string; max: string };
}

/** The fields shared by the create and edit expense forms. */
export function ExpenseFormFields({ value, onChange, fieldErrors, dateRange }: ExpenseFormFieldsProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, [event.target.name]: event.target.value });
  };
  const errorProps = (field: keyof ExpenseFormData) => ({
    error: Boolean(fieldErrors?.[field]),
    helperText: fieldErrors?.[field]?.toString(),
  });

  return (
    <>
      <FormControl fullWidth required>
        <InputLabel id="expense-type-label">Expense type</InputLabel>
        <Select
          labelId="expense-type-label"
          label="Expense type"
          value={value.type}
          onChange={(event) => onChange({ ...value, type: event.target.value as ExpenseType })}
        >
          {EXPENSE_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {EXPENSE_TYPE_LABELS[type]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Title"
        name="title"
        value={value.title}
        {...errorProps("title")}
        onChange={handleChange}
        required
        fullWidth
      />

      <TextField
        label="Description"
        name="description"
        value={value.description}
        {...errorProps("description")}
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
        value={value.amount}
        {...errorProps("amount")}
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
        label="Expense date"
        name="expenseDate"
        type="date"
        value={value.expenseDate}
        {...errorProps("expenseDate")}
        onChange={handleChange}
        required
        fullWidth
        slotProps={{
          inputLabel: {
            shrink: true,
          },
          htmlInput: dateRange,
        }}
      />
    </>
  );
}
