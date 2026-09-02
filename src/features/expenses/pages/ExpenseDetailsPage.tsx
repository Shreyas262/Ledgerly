import {
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
  Alert,
} from "@mui/material";

import { ArrowBackOutlined } from "@mui/icons-material";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { useGetExpenseByIdQuery, useSubmitExpenseMutation } from "../../../features/expenses/api/expenseApi";
import { usePermissions } from "../../../features/auth/hooks/usePermissions";

import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";

import type { ExpenseStatus } from "../../../types/common";

const statusLabels: Record<
  ExpenseStatus,
  string
> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  rejected: "Rejected",
  approved: "Approved",
  reimbursement_pending:
    "Reimbursement Pending",
  reimbursed: "Reimbursed",
  cancelled: "Cancelled",
};

export function ExpenseDetailsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [submitExpense,{ isLoading: isSubmitting, isError: isSubmitError,}] = useSubmitExpenseMutation();

  const { id } = useParams<{
    id: string;
  }>();

  const {
    data: expense,
    isLoading,
    isError,
  } = useGetExpenseByIdQuery(id ?? "");

  if (!id) {
    return <ErrorState />;
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !expense) {
    return <ErrorState />;
  }

  const handleSubmitExpense = async () => {
    try {
      await submitExpense(expense.id).unwrap();
    } catch {
      // Error is exposed through isSubmitError.
    }
  };

  return (
    <Stack spacing={3}>
      <Button
        variant="text"
        startIcon={<ArrowBackOutlined />}
        onClick={() => navigate("/expenses")}
        sx={{
          alignSelf: "flex-start",
        }}
      >
        Back to Expenses
      </Button>

      {isSubmitError && (
        <Alert severity="error">
          Failed to submit expense.
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Header */}
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            sx={{justifyContent: "space-between"}}
            spacing={2}
          >
            <Stack spacing={0.5}>
              <Typography variant="h5">
                {expense.title}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                {expense.category}
              </Typography>
            </Stack>

            <Chip
              label={
                statusLabels[expense.status]
              }
              size="small"
            />

          </Stack>
          <Stack
              direction="row"
              spacing={2}
            >
              {expense.status === "draft" &&
                can("expenses.update") && (
                  <Button
                    variant="contained"
                    onClick={() =>
                      navigate(`/expenses/${expense.id}/edit`)
                    }
                  >
                    Edit Expense
                  </Button>
                )
              }
            
              {expense.status === "draft" &&
                can("expenses.submit") && (
                  <Button
                    variant="contained"
                    onClick={handleSubmitExpense}
                    loading={isSubmitting}
                  >
                    Submit Expense
                  </Button>
                )
              }

            </Stack>

          <Divider />

          {/* Financial information */}
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={4}
          >
            <Stack spacing={0.5}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Amount
              </Typography>

              <Typography variant="h6">
                {expense.currency}{" "}
                {expense.amount.toLocaleString()}
              </Typography>
            </Stack>

            <Stack spacing={0.5}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Expense Date
              </Typography>

              <Typography variant="body1">
                {expense.expenseDate}
              </Typography>
            </Stack>

            <Stack spacing={0.5}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Employee
              </Typography>

              <Typography variant="body1">
                {expense.employeeId}
              </Typography>
            </Stack>
          </Stack>

          <Divider />

          {/* Description */}
          <Stack spacing={1}>
            <Typography
              variant="subtitle1"
              sx={{fontWeight: 600}}
            >
              Description
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
            >
              {expense.description}
            </Typography>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}