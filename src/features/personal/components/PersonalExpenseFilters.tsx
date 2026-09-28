import { MenuItem, TextField } from "@mui/material";

import { FilterBar } from "../../../components/common/FilterBar";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PERSONAL_EXPENSE_TYPES,
  PERSONAL_EXPENSE_TYPE_LABELS,
  type PaymentMethod,
  type PersonalExpenseFilter,
  type PersonalExpenseType,
} from "../types/personal";

interface PersonalExpenseFiltersProps {
  filters: PersonalExpenseFilter;
  onChange: (filters: PersonalExpenseFilter) => void;
  onReset: () => void;
}

export function PersonalExpenseFilters({ filters, onChange, onReset }: PersonalExpenseFiltersProps) {
  const set = <K extends keyof PersonalExpenseFilter>(field: K, value: PersonalExpenseFilter[K]) =>
    onChange({ ...filters, [field]: value });

  const activeCount = [
    filters.search.trim() !== "",
    filters.type !== "all",
    filters.paymentMethod !== "all",
    filters.dateFrom !== "",
    filters.dateTo !== "",
  ].filter(Boolean).length;
  const rangeError = filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo
    ? "The start date must be on or before the end date."
    : null;

  return (
    <FilterBar label="Expense filters" activeCount={activeCount} onReset={onReset} error={rangeError}>
      <TextField
        size="small"
        label="Search"
        placeholder="Description, type, amount…"
        value={filters.search}
        onChange={(event) => set("search", event.target.value)}
      />
      <TextField
        select
        size="small"
        label="Type"
        value={filters.type}
        onChange={(event) => set("type", event.target.value as PersonalExpenseType | "all")}
      >
        <MenuItem value="all">All types</MenuItem>
        {PERSONAL_EXPENSE_TYPES.map((type) => (
          <MenuItem key={type} value={type}>{PERSONAL_EXPENSE_TYPE_LABELS[type]}</MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Payment method"
        value={filters.paymentMethod}
        onChange={(event) => set("paymentMethod", event.target.value as PaymentMethod | "all")}
      >
        <MenuItem value="all">All methods</MenuItem>
        {PAYMENT_METHODS.map((method) => (
          <MenuItem key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</MenuItem>
        ))}
      </TextField>
      <TextField
        size="small"
        type="date"
        label="From"
        value={filters.dateFrom}
        onChange={(event) => set("dateFrom", event.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        size="small"
        type="date"
        label="To"
        value={filters.dateTo}
        onChange={(event) => set("dateTo", event.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    </FilterBar>
  );
}
