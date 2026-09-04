import {
  Button,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";

import type {
  Budget,
  CreateBudgetRequest,
} from "../../../types/budget";

interface BudgetFormProps {
  budget?: Budget;
  onSubmit: (data: CreateBudgetRequest) => void;
  isSubmitting?: boolean;
  onCancel: () => void;
}

interface BudgetFormState {
  name: string;
  description: string;
  amount: string;
  department: string;
  project: string;
  startDate: string;
  endDate: string;
}

const INITIAL_FORM: BudgetFormState = {
  name: "",
  description: "",
  amount: "",
  department: "",
  project: "",
  startDate: "",
  endDate: "",
};

export function BudgetForm({
  budget,
  onSubmit,
  isSubmitting = false,
  onCancel,
}: BudgetFormProps) {
  const [form, setForm] =
    useState<BudgetFormState>(INITIAL_FORM);

  const [error, setError] = useState("");

  const isEditMode = Boolean(budget);

  useEffect(() => {
    if (!budget) {
      setForm(INITIAL_FORM);
      return;
    }

    setForm({
      name: budget.name,
      description: budget.description ?? "",
      amount: String(budget.amount),
      department: budget.department ?? "",
      project: budget.project ?? "",
      startDate: budget.startDate,
      endDate: budget.endDate,
    });
  }, [budget]);

  const handleChange = (
    field: keyof BudgetFormState,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Budget name is required.");
      return;
    }

    const amount = Number(form.amount);

    if (!form.amount || amount <= 0) {
      setError(
        "Budget amount must be greater than zero.",
      );
      return;
    }

    if (!form.startDate || !form.endDate) {
      setError(
        "Start date and end date are required.",
      );
      return;
    }

    if (form.startDate > form.endDate) {
      setError(
        "Start date must be before end date.",
      );
      return;
    }

    setError("");

    onSubmit({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      amount,
      department:
        form.department || undefined,
      project: form.project || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
    });
  };

  return (
    <Stack
      component="form"
      spacing={2}
      onSubmit={handleSubmit}
    >
      <TextField
        label="Budget name"
        value={form.name}
        onChange={(event) =>
          handleChange("name", event.target.value)
        }
        required
        fullWidth
      />

      <TextField
        label="Description"
        value={form.description}
        onChange={(event) =>
          handleChange(
            "description",
            event.target.value,
          )
        }
        multiline
        minRows={3}
        fullWidth
      />

      <TextField
        label="Budget amount"
        type="number"
        value={form.amount}
        onChange={(event) =>
          handleChange("amount", event.target.value)
        }
        required
        fullWidth
        slotProps={{
          htmlInput: {
            min: 1,
          },
        }}
      />

      <TextField
        select
        label="Department"
        value={form.department}
        onChange={(event) =>
          handleChange(
            "department",
            event.target.value,
          )
        }
        fullWidth
      >
        <MenuItem value="">
          None
        </MenuItem>

        <MenuItem value="Engineering">
          Engineering
        </MenuItem>

        <MenuItem value="Marketing">
          Marketing
        </MenuItem>

        <MenuItem value="Operations">
          Operations
        </MenuItem>

        <MenuItem value="Finance">
          Finance
        </MenuItem>
      </TextField>

      <TextField
        label="Project"
        value={form.project}
        onChange={(event) =>
          handleChange(
            "project",
            event.target.value,
          )
        }
        fullWidth
      />

      <Stack
        direction={{
          xs: "column",
          sm: "row",
        }}
        spacing={2}
      >
        <TextField
          label="Start date"
          type="date"
          value={form.startDate}
          onChange={(event) =>
            handleChange(
              "startDate",
              event.target.value,
            )
          }
          required
          fullWidth
          slotProps={{
            inputLabel: {
              shrink: true,
            },
          }}
        />

        <TextField
          label="End date"
          type="date"
          value={form.endDate}
          onChange={(event) =>
            handleChange(
              "endDate",
              event.target.value,
            )
          }
          required
          fullWidth
          slotProps={{
            inputLabel: {
              shrink: true,
            },
          }}
        />
      </Stack>

      {error && (
        <TextField
          error
          value={error}
          slotProps={{
            input: {
              readOnly: true,
            },
          }}
        />
      )}

      <Stack
        direction="row"
        spacing={2}
        sx={{
          justifyContent: "flex-end",
        }}
      >
        <Button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          variant="contained"
          loading={isSubmitting}
        >
          {isEditMode
            ? "Update Budget"
            : "Create Budget"}
        </Button>
      </Stack>
    </Stack>
  );
}