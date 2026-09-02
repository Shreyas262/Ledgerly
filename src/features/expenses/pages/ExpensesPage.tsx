import {
  Stack,
  Typography,
  Button,
  Alert,
} from "@mui/material";

import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { ExpenseCard } from "../components/ExpenseCard";

import { useGetExpensesQuery, useSubmitExpenseMutation } from "../../expenses/api/expenseApi";

import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";

import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { type ExpenseFilter as ExpenseFiltersState, initialExpenseFilters } from "../../../types/expense";
import { ExpenseFilters } from "../components/ExpenseFilters";

export function ExpensesPage() {

  const [submittingExpenseId, setSubmittingExpenseId] = useState<string | null>(null);
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ExpenseFiltersState>(initialExpenseFilters);

  const hasInvalidDateRange =
    filters.dateFrom !== "" &&
    filters.dateTo !== "" &&
    filters.dateFrom > filters.dateTo;

  const {
    data: expenses,
    isLoading,
    isError,
  } = useGetExpensesQuery();

  const [submitExpense] = useSubmitExpenseMutation();
  const categories = useMemo(() => {
    if (!expenses) {
      return [];
    }

    return Array.from(
      new Set(
        expenses.map(
          (expense) => expense.category,
        ),
      ),
    );
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    if (!expenses || hasInvalidDateRange) {
      return [];
    }

    const search = filters.search
      .trim()
      .toLowerCase();

    return expenses.filter((expense) => {
      const matchesSearch =
        search === "" ||
        expense.title
          .toLowerCase()
          .includes(search) ||
        expense.description
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        filters.status === "all" ||
        expense.status === filters.status;

      const matchesCategory =
        filters.category === "all" ||
        expense.category === filters.category;

      const matchesDateFrom =
        filters.dateFrom === "" ||
        expense.expenseDate >= filters.dateFrom;

      const matchesDateTo =
        filters.dateTo === "" ||
        expense.expenseDate <= filters.dateTo;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [expenses, filters, hasInvalidDateRange]);

  if (!can("expenses.read")) {
    return <ErrorState />;
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState />;
  }

  const handleSubmitExpense = async (expenseId: string) => {
    try {
      setSubmittingExpenseId(expenseId);

      await submitExpense(expenseId).unwrap();
    } finally {
      setSubmittingExpenseId(null);
    }
  };

  const handleResetFilters = () => {
    setFilters(initialExpenseFilters);
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Stack
        sx={{
          display: "flex",
          flexDirection: {
            xs: "column",
            sm: "row",
          },
          justifyContent: "space-between",
          alignItems: {
            xs: "flex-start",
            sm: "center",
          },
          gap: 2,
        }}
      >
        <Typography variant="h4">
          Expenses
        </Typography>

        {can("expenses.create") && (
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => navigate("/expenses/new")}
          >
            Create Expense
          </Button>
        )}
      </Stack>

      <ExpenseFilters
        filters={filters}
        categories={categories}
        onChange={setFilters}
        onReset={handleResetFilters}
      />

      {hasInvalidDateRange && (
        <Alert severity="warning">
          The start date cannot be later than the end date.
        </Alert>
      )}

      {/* Expense list */}
      {!expenses?.length ? (
        <EmptyState />
      ) : (
        <Stack spacing={2}>
            {filteredExpenses.length > 0 ?
              filteredExpenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  onView={() =>
                    navigate(`/expenses/${expense.id}`)
                  }
                  onSubmit={() =>
                    handleSubmitExpense(expense.id)
                  }
                  isSubmitting={
                    submittingExpenseId === expense.id
                  }
                />
              )) :
              expenses.length > 0 &&
                filteredExpenses.length === 0 && (
                  <Alert severity="info">
                    No expenses match your filters.
                  </Alert>
                )
            }
        </Stack>
      )}
    </Stack>
  );
}