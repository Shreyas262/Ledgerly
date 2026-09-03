import {
  Alert,
  Stack,
  Typography,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import {
  useGetExpensesQuery,
  useStartExpenseReviewMutation,
} from "../../expenses/api/expenseApi";

import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";

import { ExpenseCard } from "../../expenses/components/ExpenseCard";
import type { Expense } from "../../../types/expense";

export function ApprovalsPage() {
  const navigate = useNavigate();

  const {
    data: expenses,
    isLoading,
    isError,
  } = useGetExpensesQuery();

  const [
    startExpenseReview,
    {
      isLoading: isStartingReview,
    },
  ] = useStartExpenseReviewMutation();

  const handleStartReview = async (
    expense: Expense,
  ) => {
    try {
      await startExpenseReview(
        String(expense.id),
      ).unwrap();

      navigate(
        `/approvals/${expense.id}`,
      );
    } catch (error) {
      console.error(
        "Failed to start expense review:",
        error,
      );
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState />;
  }

  const approvalExpenses =
    expenses?.filter(
      (expense) =>
        expense.status === "submitted" ||
        expense.status === "under_review",
    ) ?? [];

  return (
    <Stack spacing={3}>
      <Typography variant="h4">
        Approval Queue
      </Typography>

      {approvalExpenses.length === 0 ? (
        <Alert severity="info">
          There are no expenses waiting for
          approval.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {approvalExpenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              variant="approval"
              onView={(selectedExpense) =>
                navigate(
                  `/approvals/${selectedExpense.id}`,
                )
              }
              onStartReview={handleStartReview}
              isStartingReview={
                isStartingReview
              }
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}