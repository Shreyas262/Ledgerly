import { useConfirm } from "../../../components/common/ConfirmProvider";
import { Stack, Typography, Button, Alert, Pagination, Tab, Tabs } from "@mui/material";

import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { ExpenseCard } from "../components/ExpenseCard";
import { BulkSubmitSummary, type BulkSubmitOutcome } from "../components/BulkSubmitSummary";
import { BulkActionBar } from "../../../components/common/BulkActionBar";
import { formatCurrency } from "../../../utils/currency";

import {
  useGetExpensesQuery,
  useSubmitExpenseMutation,
  useBulkSubmitExpensesMutation,
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
import { useGetActiveBudgetPeriodQuery } from "../../budgets/api/budgetsApi";
import { PageHeader } from "../../../components/common/PageHeader";

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
  const [budgetWarnings, setBudgetWarnings] = useState<string[]>([]);
  const { can } = usePermissions();
  const { user } = useAuth();
  // Expenses can be created only while an active budget covers today.
  const { data: eligibility } = useGetActiveBudgetPeriodQuery(undefined, { refetchOnMountOrArgChange: true });
  const creationBlocked = eligibility ? !eligibility.canCreateExpense : false;
  const confirm = useConfirm();
  const navigate = useNavigate();
  const widerScope = getAuthorizedWiderScope(user?.role);
  const [selectedScope, setSelectedScope] = useState<ExpenseScope>("OWN");
  const scope: ExpenseScope = selectedScope === "OWN" || selectedScope === widerScope ? selectedScope : "OWN";
  // Each view keeps its own filters and page.
  const [viewStates, setViewStates] = useState<Partial<Record<ExpenseScope, ScopeViewState>>>({});
  const { filters, page } = viewStates[scope] ?? initialViewState;
  // Drafts selected for submitting together. Only what is on screen can be
  // selected, so the selection is cleared whenever the list changes.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [bulkOutcome, setBulkOutcome] = useState<BulkSubmitOutcome | null>(null);
  const updateView = (next: Partial<ScopeViewState>) => {
    setSelectedIds(new Set());
    setViewStates((current) => ({
      ...current,
      [scope]: { ...(current[scope] ?? initialViewState), ...next },
    }));
  };
  const setPage = (nextPage: number) => updateView({ page: nextPage });

  const hasInvalidDateRange =
    filters.dateFrom !== "" &&
    filters.dateTo !== "" &&
    filters.dateFrom > filters.dateTo;

  const {
    data: expenseResult,
    isLoading,
    isError,
    error: loadError,
    refetch,
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
  const [bulkSubmitExpenses, { isLoading: isBulkSubmitting, error: bulkSubmitError }] = useBulkSubmitExpensesMutation();

  // The user's drafts on this page that can be submitted (they have a receipt); the API checks each one again.
  const selectableExpenses =
    scope === "OWN" && can("expenses.submit")
      ? expenses.filter((expense) => expense.status === "draft" && expense.employeeId === user?.id && expense.documentIds?.length)
      : [];
  const selectedExpenses = selectableExpenses.filter((expense) => selectedIds.has(expense.id));

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={loadError} onRetry={refetch} />;
  }

  const handleSubmitExpense = async (expenseId: string) => {
    if (!(await confirm({ title: "Submit Expense", message: "Submit this expense for approval? You will not be able to edit it while it is being reviewed.", confirmLabel: "Submit" }))) return;
    try {
      setSubmittingExpenseId(expenseId);

      const submitted = await submitExpense(expenseId).unwrap();
      setBudgetWarnings(submitted.budgetWarnings ?? []);
    } catch {
      // Error (e.g. a policy violation) is exposed through submitError.
    } finally {
      setSubmittingExpenseId(null);
    }
  };

  const toggleSelected = (expenseId: string, selected: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(expenseId);
      else next.delete(expenseId);
      return next;
    });

  const handleBulkSubmit = async () => {
    const count = selectedExpenses.length;
    const total = selectedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    if (!(await confirm({
      title: "Submit Expenses",
      message: `Submit ${count} ${count === 1 ? "expense" : "expenses"} totalling ${formatCurrency(total)} for approval? You will not be able to edit them while they are being reviewed. Each expense is checked individually.`,
      confirmLabel: "Submit",
    }))) return;

    try {
      const results = await bulkSubmitExpenses(selectedExpenses.map((expense) => expense.id)).unwrap();
      const titleOf = (id: string) => selectedExpenses.find((expense) => expense.id === id)?.title ?? "Expense";
      const failures = results.filter((result) => !result.ok);
      setBulkOutcome({
        submitted: results.length - failures.length,
        failures: failures.map((result) => ({ title: titleOf(result.expenseId), message: result.ok ? "" : result.message })),
      });
      setBudgetWarnings([...new Set(results.flatMap((result) => (result.ok ? result.expense.budgetWarnings ?? [] : [])))]);
      // Drafts that were not submitted stay selected, so they can be corrected and tried again.
      setSelectedIds(new Set(failures.map((result) => result.expenseId)));
    } catch {
      // The request as a whole failed; the reason is shown through bulkSubmitError.
    }
  };

  const handleResetFilters = () => {
    updateView(initialViewState);
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Expenses"
        actions={can("expenses.create") && (
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => navigate("/expenses/new")}
            disabled={creationBlocked}
          >
            Create Expense
          </Button>
        )}
      />

      {can("expenses.create") && creationBlocked && (
        <Alert severity="info">
          {eligibility?.reason} Existing drafts can still be submitted.
        </Alert>
      )}

      {widerScope && (
        <Tabs
          value={scope}
          onChange={(_event, nextScope: ExpenseScope) => {
            setSelectedIds(new Set());
            setSelectedScope(nextScope);
          }}
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
      {bulkSubmitError && <ApiFeedback error={bulkSubmitError} />}
      {bulkOutcome && <BulkSubmitSummary outcome={bulkOutcome} onClose={() => setBulkOutcome(null)} />}

      {budgetWarnings.length > 0 && (
        <Alert severity="warning" onClose={() => setBudgetWarnings([])}>
          {budgetWarnings.map((warning) => (
            <Typography key={warning} variant="body2">{warning}</Typography>
          ))}
        </Alert>
      )}

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
          {selectableExpenses.length > 0 && (
            <BulkActionBar
              selectedCount={selectedExpenses.length}
              selectableCount={selectableExpenses.length}
              selectAllLabel="Select All Drafts"
              onSelectAll={(selected) => setSelectedIds(new Set(selected ? selectableExpenses.map((expense) => expense.id) : []))}
              onClear={() => setSelectedIds(new Set())}
            >
              <Button
                variant="contained"
                onClick={handleBulkSubmit}
                loading={isBulkSubmitting}
                disabled={selectedExpenses.length === 0}
              >
                Submit Selected
              </Button>
            </BulkActionBar>
          )}
          {expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onView={() => navigate(`/expenses/${expense.id}`)}
              onSubmit={() => handleSubmitExpense(expense.id)}
              isSubmitting={submittingExpenseId === expense.id || (isBulkSubmitting && selectedIds.has(expense.id))}
              selected={selectedIds.has(expense.id)}
              onSelectedChange={scope === "OWN" ? (_expense, selected) => toggleSelected(expense.id, selected) : undefined}
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
