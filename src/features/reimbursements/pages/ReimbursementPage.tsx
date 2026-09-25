import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useGetReimbursementQueueQuery } from "../api/reimbursementApi";
import {
  useReimburseExpenseMutation,
  useStartReimbursementMutation,
} from "../../expenses/api/expenseApi";
import type { ExpenseStatus } from "../../expenses/types/expense";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";

type ReimbursementView = Extract<
  ExpenseStatus,
  "approved" | "reimbursement_pending" | "reimbursed" | "cancelled"
>;

const views: Record<ReimbursementView, { label: string; chip: string; empty: string }> = {
  approved: {
    label: "To Process",
    chip: "Approved",
    empty: "There are no approved expenses waiting for reimbursement.",
  },
  reimbursement_pending: {
    label: "In Progress",
    chip: "Processing",
    empty: "There are no reimbursements in progress.",
  },
  reimbursed: {
    label: "Reimbursed",
    chip: "Reimbursed",
    empty: "No expenses have been reimbursed yet.",
  },
  cancelled: {
    label: "Cancelled",
    chip: "Cancelled",
    empty: "No expenses have been cancelled during financial processing.",
  },
};

export function ReimbursementPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<ReimbursementView>("approved");

  const {
    currentData: expenses,
    isFetching,
    isError,
  } = useGetReimbursementQueueQuery({
    filter: { status: view },
    sort: "updatedAt",
    sortOrder: "desc",
  });

  const [startReimbursement, { isLoading: isStarting, error: startError }] =
    useStartReimbursementMutation();
  const [reimburseExpense, { isLoading: isReimbursing, error: reimburseError }] =
    useReimburseExpenseMutation();
  const mutationError = startError ?? reimburseError;

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4">Reimbursements</Typography>
        <Typography color="text.secondary">
          Approved expenses from the departments you are authorized for.
        </Typography>
      </Stack>

      <Tabs
        value={view}
        onChange={(_event, nextView: ReimbursementView) => setView(nextView)}
        aria-label="Reimbursement status"
        variant="scrollable"
        allowScrollButtonsMobile
      >
        {(Object.keys(views) as ReimbursementView[]).map((status) => (
          <Tab key={status} value={status} label={views[status].label} />
        ))}
      </Tabs>

      {mutationError && <ApiFeedback error={mutationError} />}

      {isFetching && !expenses ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState />
      ) : !expenses?.length ? (
        <Alert severity="info">{views[view].empty}</Alert>
      ) : (
        <Stack spacing={2}>
          {expenses.map((expense) => (
            <Paper key={expense.id} sx={{ p: 2.5 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ justifyContent: "space-between" }}
              >
                <Stack spacing={0.5}>
                  <Typography variant="h6">
                    {expense.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Employee: {expense.employeeName ?? expense.employeeId}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Amount: {expense.currency}{" "}
                    {expense.amount.toLocaleString("en-IN")}
                  </Typography>
                  <Chip
                    size="small"
                    label={views[view].chip}
                    sx={{ alignSelf: "flex-start" }}
                  />
                </Stack>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
                >
                  <Button
                    variant="outlined"
                    onClick={() => navigate(`/expenses/${expense.id}`)}
                  >
                    View
                  </Button>

                  {expense.status === "approved" && (
                    <Button
                      variant="contained"
                      loading={isStarting}
                      onClick={() =>
                        startReimbursement(expense.id)
                      }
                    >
                      Start Reimbursement
                    </Button>
                  )}

                  {expense.status === "reimbursement_pending" && (
                    <Button
                      variant="contained"
                      loading={isReimbursing}
                      onClick={() =>
                        reimburseExpense(expense.id)
                      }
                    >
                      Mark Reimbursed
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
