import type React from "react";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";

import { FilterBar } from "../../../components/common/FilterBar";
import type { ExpenseFilter as ExpenseFiltersState } from "../types/expense";
import {
  EXPENSE_STATUS_LABELS,
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
  ...(Object.entries(EXPENSE_STATUS_LABELS) as Array<[ExpenseStatus, string]>).map(([value, label]) => ({ value, label })),
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



  const activeCount = [
    filters.search.trim() !== "",
    filters.status !== "all",
    filters.type !== "all",
    filters.dateFrom !== "",
    filters.dateTo !== "",
  ].filter(Boolean).length;

  return (
    <FilterBar label="Expense filters" activeCount={activeCount} onReset={onReset}>
      <TextField
        size="small"
        label="Search expenses"
        value={filters.search}
        onChange={handleSearchChange}
      />

      <FormControl size="small">
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

      <FormControl size="small">
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
        size="small"
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
      />

      <TextField
        size="small"
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
      />
    </FilterBar>
  );
}
