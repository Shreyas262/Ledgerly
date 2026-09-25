import {
  Alert,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useGetApprovalQueueQuery } from "../api/approvalApi";
import {
  useStartExpenseReviewMutation,
} from "../../expenses/api/expenseApi";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { ExpenseCard } from "../../expenses/components/ExpenseCard";
import type { Expense } from "../../expenses/types/expense";

export function ApprovalsPage() {
  const navigate = useNavigate();

  const {
    data: expenses,
    isLoading,
    isError,
  } = useGetApprovalQueueQuery();

  const [startExpenseReview, { isLoading: isStartingReview, error: startReviewError }] =
    useStartExpenseReviewMutation();

  const handleStartReview = async (expense: Expense) => {
    try {
      await startExpenseReview(String(expense.id)).unwrap();
      navigate(`/approvals/${expense.id}`);
    } catch {
      // Error is exposed through startReviewError.
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState />;
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Approval Queue</Typography>

      {startReviewError && <ApiFeedback error={startReviewError} />}

      {!expenses?.length ? (
        <Alert severity="info">
          There are no expenses waiting for approval.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              variant="approval"
              onView={(selectedExpense) =>
                navigate(`/approvals/${selectedExpense.id}`)
              }
              onStartReview={handleStartReview}
              isStartingReview={isStartingReview}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
