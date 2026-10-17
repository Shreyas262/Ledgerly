import { useState, type FormEvent } from "react";
import { Alert, Button, Paper, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { ExpensePolicyPreview } from "../../policies/components/ExpensePolicyPreview";
import { useGetActiveBudgetPeriodQuery } from "../../budgets/api/budgetsApi";
import { useCreateExpenseMutation } from "../api/expenseApi";
import { ExpenseFormFields } from "../components/ExpenseFormFields";
import { EMPTY_EXPENSE_FORM, isExpenseFormComplete, toExpenseRequest, type ExpenseFormData } from "../utils/expenseForm";
import { useConfirm } from "../../../components/common/ConfirmProvider";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { PageHeader } from "../../../components/common/PageHeader";
import { BackLink } from "../../../components/navigation/BackLink";
import { getApiErrorDetails } from "../../../services/api/apiErrors";
import { formatCurrency } from "../../../utils/currency";
import { formatDate } from "../../../utils/format";

export function CreateExpensePage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [formData, setFormData] = useState<ExpenseFormData>(EMPTY_EXPENSE_FORM);

  const [createExpense, { isLoading, error }] = useCreateExpenseMutation();
  const { data: eligibility } = useGetActiveBudgetPeriodQuery(undefined, { refetchOnMountOrArgChange: true });
  const activePeriod = eligibility?.period;
  const creationBlocked = eligibility ? !eligibility.canCreateExpense : false;
  const details = getApiErrorDetails(error);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isExpenseFormComplete(formData)) {
      return;
    }

    const request = toExpenseRequest(formData);
    if (!(await confirm({ title: "Create Expense", message: `Create "${request.title}" for ${formatCurrency(request.amount)} as a draft?`, confirmLabel: "Create" }))) return;

    try {
      const createdExpense = await createExpense(request).unwrap();
      navigate(`/expenses/${createdExpense.id}`);
    } catch {
      // Preserve form input so the user can correct or retry after a server failure.
    }
  };

  return (
    <Stack spacing={3}>
      <BackLink to="/expenses" label="Expenses" />

      <PageHeader title="Create Expense" />

      {creationBlocked && (
        <Alert severity="warning">
          {eligibility?.reason}
        </Alert>
      )}
      {activePeriod && (
        <Alert severity="info">
          The expense date must fall within the active budget period ({formatDate(activePeriod.startDate)} to {formatDate(activePeriod.endDate)}).
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stack component="form" spacing={3} onSubmit={handleSubmit}>
          {error && <ApiFeedback error={error} />}

          <ExpenseFormFields
            value={formData}
            onChange={setFormData}
            fieldErrors={details.fieldErrors}
            dateRange={activePeriod ? { min: activePeriod.startDate, max: activePeriod.endDate } : undefined}
          />

          <ExpensePolicyPreview
            type={formData.type}
            amount={formData.amount}
            expenseDate={formData.expenseDate}
            description={formData.description}
          />

          <Stack
            direction="row"
            sx={{ justifyContent: "flex-end" }}
            spacing={2}
          >
            <Button
              variant="outlined"
              onClick={() => navigate("/expenses")}
              disabled={isLoading}
            >
              Cancel
            </Button>

            <Button type="submit" variant="contained" loading={isLoading} disabled={creationBlocked}>
              Create Expense
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
