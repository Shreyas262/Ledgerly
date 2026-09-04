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

import type { ExpenseFilter as ExpenseFiltersState } from "../../../types/expense";
import type { ExpenseStatus } from "../../../types/common";

interface ExpenseFiltersProps {
  filters: ExpenseFiltersState;
  categories: string[];
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
  categories,
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

  // Fixed: Uses SelectChangeEvent instead of React.ChangeEvent<HTMLInputElement>
  const handleCategoryChange = (event: SelectChangeEvent<string>) => {
    onChange({
      ...filters,
      category: event.target.value,
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
        <InputLabel>Category</InputLabel>
        <Select
          label="Category"
          value={filters.category}
          onChange={handleCategoryChange}
        >
          <MenuItem value="all">All categories</MenuItem>
          {categories.map((category) => (
            <MenuItem key={category} value={category}>
              {category}
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