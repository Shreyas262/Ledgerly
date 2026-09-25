import type React from "react";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Button,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";

import type { ExpenseFilter as ExpenseFiltersState } from "../types/expense";
import {
  EXPENSE_TYPES,
  EXPENSE_TYPE_LABELS,
  type ExpenseStatus,
  type ExpenseType,
} from "../types/expense";

interface ExpenseFiltersProps {
  filters: ExpenseFiltersState;
  onChange: (filters: ExpenseFiltersState) => void;
  onReset: () => void;
}

const statusOptions: {
  value: ExpenseStatus | "all";
  label: string;
}[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "rejected", label: "Rejected" },
  { value: "approved", label: "Approved" },
  { value: "reimbursement_pending", label: "Reimbursement Pending" },
  { value: "reimbursed", label: "Reimbursed" },
  { value: "cancelled", label: "Cancelled" },
];

export function ExpenseFilters({
  filters,
  onChange,
  onReset,
}: ExpenseFiltersProps) {
  // Corrected type for TextField
  const handleSearchChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({
      ...filters,
      search: event.target.value,
    });
  };

  // Fixed: Uses SelectChangeEvent instead of React.ChangeEvent<HTMLInputElement>
  const handleStatusChange = (event: SelectChangeEvent<string>) => {
    onChange({
      ...filters,
      status: event.target.value as ExpenseStatus | "all",
    });
  };



  return (
    <Stack
      direction={{
        xs: "column",
        md: "row",
      }}
      sx={{ alignItems: "center",}}
      spacing={2}
    >
      <TextField
        label="Search expenses"
        value={filters.search}
        onChange={handleSearchChange}
        fullWidth
      />

      <FormControl fullWidth>
        <InputLabel>Status</InputLabel>
        <Select
          label="Status"
          value={filters.status}
          onChange={handleStatusChange}
        >
          {statusOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth>
        <InputLabel>Expense Type</InputLabel>
        <Select
          label="Expense Type"
          value={filters.type}
          onChange={(event: SelectChangeEvent<string>) =>
            onChange({
              ...filters,
              type: event.target.value as ExpenseType | "all",
            })
          }
        >
          <MenuItem value="all">All expense types</MenuItem>
          {EXPENSE_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {EXPENSE_TYPE_LABELS[type]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="From"
        type="date"
        value={filters.dateFrom}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          onChange({
            ...filters,
            dateFrom: event.target.value,
          })
        }
        slotProps={{
          inputLabel: {
            shrink: true,
          },
        }}
        fullWidth
      />

      <TextField
        label="To"
        type="date"
        value={filters.dateTo}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          onChange({
            ...filters,
            dateTo: event.target.value,
          })
        }
        slotProps={{
          inputLabel: {
            shrink: true,
          },
        }}
        fullWidth
      />

      <Button
        variant="text"
        onClick={onReset}
        sx={{ whitespace: "nowrap" }}
      >
        Reset Filters
      </Button>
    </Stack>
  );
}