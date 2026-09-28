import { useConfirm } from "../../../components/common/ConfirmProvider";
import {
  Alert,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useGetApprovalQueueQuery } from "../api/approvalApi";
import {
  useStartExpenseReviewMutation,
} from "../../expenses/api/expenseApi";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { ExpenseCard } from "../../expenses/components/ExpenseCard";
import type { Expense } from "../../expenses/types/expense";
import { ReimbursementQueue } from "../../reimbursements/components/ReimbursementQueue";
import { usePermissions } from "../../auth/hooks/usePermissions";
import { PageHeader } from "../../../components/common/PageHeader";

type ApprovalTab = "review" | "reimbursement";

/**
 * Workflow hub. Review (managerial approval) and Reimbursement (finance
 * processing) remain separate responsibilities with separate authorization
 * (§22.13); each tab is shown only to users holding its permission.
 */
export function ApprovalsPage() {
  const { can } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const canReview = can("expenses.approve");
  const canReimburse = can("reimbursements.manage");

  const requestedTab = searchParams.get("tab") as ApprovalTab | null;
  const tab: ApprovalTab =
    requestedTab === "reimbursement" && canReimburse
      ? "reimbursement"
      : requestedTab === "review" && canReview
        ? "review"
        : canReview
          ? "review"
          : "reimbursement";

  return (
    <Stack spacing={3}>
      <PageHeader title="Approvals" />

      {canReview && canReimburse && (
        <Tabs
          value={tab}
          onChange={(_event, nextTab: ApprovalTab) =>
            setSearchParams({ tab: nextTab }, { replace: true })
          }
          aria-label="Approval workflow"
        >
          <Tab value="review" label="Review" />
          <Tab value="reimbursement" label="Reimbursement" />
        </Tabs>
      )}

      {tab === "review" ? <ReviewQueue /> : <ReimbursementQueue />}
    </Stack>
  );
}

function ReviewQueue() {
  const navigate = useNavigate();
  const confirm = useConfirm();

  const {
    data: expenses,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetApprovalQueueQuery();

  const [startExpenseReview, { isLoading: isStartingReview, error: startReviewError }] =
    useStartExpenseReviewMutation();

  const handleStartReview = async (expense: Expense) => {
    if (!(await confirm({ title: "Start Review", message: `Start reviewing "${expense.title}"?`, confirmLabel: "Start Review" }))) return;
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
    return <ErrorState error={error} onRetry={refetch} />;
  }

  return (
    <Stack spacing={3}>
      <Typography color="text.secondary">
        Submitted expenses awaiting your review.
      </Typography>

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
