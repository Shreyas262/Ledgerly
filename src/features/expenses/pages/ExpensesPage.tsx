import { Stack, Typography, Button, Alert, Pagination, Tab, Tabs } from "@mui/material";

import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { ExpenseCard } from "../components/ExpenseCard";

import {
  useGetExpensesQuery,
  useSubmitExpenseMutation,
} from "../../expenses/api/expenseApi";

import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";

import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { useAuth } from "../../../features/auth/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  type ExpenseFilter as ExpenseFiltersState,
  type ExpenseScope,
  initialExpenseFilters,
} from "../types/expense";
import { ExpenseFilters } from "../components/ExpenseFilters";

/**
 * The wider view a role is authorized for. The API enforces this scope; the
 * UI only uses it to decide which views to offer.
 */
function getAuthorizedWiderScope(role: string | undefined): Exclude<ExpenseScope, "OWN"> | null {
  switch (role) {
    case "admin":
      return "ORGANIZATION";
    case "finance":
      return "DEPARTMENT";
    case "manager":
      return "TEAM";
    default:
      return null;
  }
}

const scopeViews: Record<ExpenseScope, { label: string; description: string }> = {
  OWN: { label: "My Expenses", description: "Expenses you have created." },
  TEAM: { label: "Team Expenses", description: "Expenses submitted by members of your team." },
  DEPARTMENT: { label: "Department Expenses", description: "Expenses submitted across the departments you are authorized for." },
  ORGANIZATION: { label: "Organization Expenses", description: "Expenses submitted across the organization." },
};

interface ScopeViewState {
  filters: ExpenseFiltersState;
  page: number;
}

const initialViewState: ScopeViewState = { filters: initialExpenseFilters, page: 1 };

export function ExpensesPage() {
  const [submittingExpenseId, setSubmittingExpenseId] = useState<string | null>(
    null,
  );
  const { can } = usePermissions();
  const { user } = useAuth();
  const navigate = useNavigate();
  const widerScope = getAuthorizedWiderScope(user?.role);
  const [selectedScope, setSelectedScope] = useState<ExpenseScope>("OWN");
  const scope: ExpenseScope = selectedScope === "OWN" || selectedScope === widerScope ? selectedScope : "OWN";
  // Each view keeps its own filters and page.
  const [viewStates, setViewStates] = useState<Partial<Record<ExpenseScope, ScopeViewState>>>({});
  const { filters, page } = viewStates[scope] ?? initialViewState;
  const updateView = (next: Partial<ScopeViewState>) =>
    setViewStates((current) => ({
      ...current,
      [scope]: { ...(current[scope] ?? initialViewState), ...next },
    }));
  const setPage = (nextPage: number) => updateView({ page: nextPage });

  const hasInvalidDateRange =
    filters.dateFrom !== "" &&
    filters.dateTo !== "" &&
    filters.dateFrom > filters.dateTo;

  const {
    data: expenseResult,
    isLoading,
    isError,
  } = useGetExpensesQuery(
    {
      scope,
      query: {
        page,
        pageSize: 25,
        search: filters.search || undefined,
        filter: {
          ...(filters.status !== "all" ? { status: filters.status } : {}),
          ...(filters.type !== "all" ? { type: filters.type } : {}),
        },
        from: filters.dateFrom || undefined,
        to: filters.dateTo || undefined,
        sort: "expenseDate",
        sortOrder: "desc",
      },
    },
    { skip: hasInvalidDateRange },
  );

  const expenses = expenseResult?.data ?? [];

  const [submitExpense, { error: submitError }] = useSubmitExpenseMutation();
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
    } catch {
      // Error (e.g. a policy violation) is exposed through submitError.
    } finally {
      setSubmittingExpenseId(null);
    }
  };

  const handleResetFilters = () => {
    updateView(initialViewState);
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
        <Typography variant="h4">Expenses</Typography>

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

      {widerScope && (
        <Tabs
          value={scope}
          onChange={(_event, nextScope: ExpenseScope) => setSelectedScope(nextScope)}
          aria-label="Expense scope"
        >
          <Tab value="OWN" label={scopeViews.OWN.label} />
          <Tab value={widerScope} label={scopeViews[widerScope].label} />
        </Tabs>
      )}

      <Typography color="text.secondary">
        {scopeViews[scope].description}
      </Typography>

      <ExpenseFilters
        filters={filters}
        onChange={(nextFilters) => {
          updateView({ filters: nextFilters, page: 1 });
        }}
        onReset={handleResetFilters}
      />

      {submitError && <ApiFeedback error={submitError} />}

      {hasInvalidDateRange && (
        <Alert severity="warning">
          The start date cannot be later than the end date.
        </Alert>
      )}

      {/* Expense list */}
      {!expenseResult || expenseResult.total === 0 ? (
        <EmptyState />
      ) : (
        <Stack spacing={2}>
          {expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onView={() => navigate(`/expenses/${expense.id}`)}
              onSubmit={() => handleSubmitExpense(expense.id)}
              isSubmitting={submittingExpenseId === expense.id}
            />
          ))}
        </Stack>
      )}

      {expenseResult && expenseResult.total > expenseResult.pageSize && (
        <Stack sx={{ alignItems: "center" }}>
          <Pagination
            page={expenseResult.page}
            count={Math.ceil(expenseResult.total / expenseResult.pageSize)}
            onChange={(_event, nextPage) => setPage(nextPage)}
            color="primary"
          />
        </Stack>
      )}
    </Stack>
  );
}
