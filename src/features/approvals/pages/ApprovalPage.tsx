import { useConfirm } from "../../../components/common/useConfirm";
import {
  Alert,
  Button,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";

import { useGetApprovalQueueQuery } from "../api/approvalApi";
import { useGetDelegationsQuery } from "../api/delegationApi";
import { useAuth } from "../../auth/hooks/useAuth";
import { formatDate } from "../../../utils/format";
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
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canReview = can("expenses.approve");
  const canReimburse = can("reimbursements.manage");
  // Managers and Finance users who review can delegate their reviews (§22.12).
  const canDelegate = canReview && (user?.role === "manager" || user?.role === "finance");

  const requestedTab = searchParams.get("tab") as ApprovalTab | null;
  // Review is the default tab; Reimbursement opens when requested and allowed.
  const tab: ApprovalTab =
    (requestedTab === "reimbursement" && canReimburse) || !canReview ? "reimbursement" : "review";

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Approvals"
        actions={canDelegate && (
          <Button component={RouterLink} to="/account/delegation" variant="outlined">
            Delegate Reviews
          </Button>
        )}
      />

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
  const { data: delegations } = useGetDelegationsQuery();
  const actingFor = delegations?.received.filter((delegation) => delegation.inEffect) ?? [];

  const [startExpenseReview, { error: startReviewError }] = useStartExpenseReviewMutation();
  const [startingExpenseId, setStartingExpenseId] = useState<string | null>(null);

  const handleStartReview = async (expense: Expense) => {
    const onBehalf = expense.actingOnBehalfOfName ? ` on behalf of ${expense.actingOnBehalfOfName}` : "";
    if (!(await confirm({ title: "Start Review", message: `Start reviewing "${expense.title}"${onBehalf}?`, confirmLabel: "Start Review" }))) return;
    setStartingExpenseId(expense.id);
    try {
      await startExpenseReview(expense.id).unwrap();
      navigate(`/approvals/${expense.id}`);
    } catch {
      // Error is exposed through startReviewError.
    } finally {
      setStartingExpenseId(null);
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

      {actingFor.length > 0 && (
        <Alert severity="info">
          You are also reviewing on behalf of{" "}
          {actingFor.map((delegation) => `${delegation.delegatorName} until ${formatDate(delegation.endDate)}`).join(" and ")}.
          Expenses you review for them are marked in the list.
        </Alert>
      )}

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
              isStartingReview={startingExpenseId === expense.id}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
