import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddOutlined, DeleteOutlineOutlined, EditOutlined, SavingsOutlined } from "@mui/icons-material";

import { PageHeader } from "../../../components/common/PageHeader";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { useConfirm } from "../../../components/common/ConfirmProvider";
import { useDeletePersonalBudgetMutation, useGetPersonalBudgetsQuery } from "../api/personalApi";
import type { PersonalBudgetWithUsage } from "../types/personal";
import { PersonalBudgetCard } from "../components/PersonalBudgetCard";
import { PersonalBudgetDialog } from "../components/PersonalBudgetDialog";
import { currentMonth, formatMonth } from "../utils/personalFormat";

type DialogState = { open: false } | { open: true; budget?: PersonalBudgetWithUsage; month?: string };

export function PersonalBudgetsPage() {
  const confirm = useConfirm();
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [notice, setNotice] = useState<string | null>(null);
  const { data: budgets = [], isLoading, isError, error, refetch } = useGetPersonalBudgetsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const [deleteBudget, { error: deleteError }] = useDeletePersonalBudgetMutation();

  const thisMonth = currentMonth();
  const hasCurrent = budgets.some((budget) => budget.month === thisMonth);

  const handleDelete = async (budget: PersonalBudgetWithUsage) => {
    if (!(await confirm({
      title: "Delete Budget",
      message: `Delete the budget for ${formatMonth(budget.month)}? Your expenses are not affected.`,
      confirmLabel: "Delete",
      destructive: true,
    }))) return;
    try {
      await deleteBudget(budget.id).unwrap();
      setNotice(`The budget for ${formatMonth(budget.month)} has been deleted.`);
    } catch {
      // The reason is shown above the budgets.
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Budgets"
        description="Set a spending limit for each month and see how you are tracking."
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setDialog({ open: true })}>
            Create Budget
          </Button>
        }
      />

      {deleteError && <ApiFeedback error={deleteError} />}

      {isLoading ? (
        <LoadingState message="Loading budgets…" />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : budgets.length === 0 ? (
        <Paper>
          <EmptyState
            title="No budgets yet"
            message="Create a monthly budget to see how your spending compares with your plan."
            action={
              <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setDialog({ open: true, month: thisMonth })}>
                Create a budget for {formatMonth(thisMonth)}
              </Button>
            }
          />
        </Paper>
      ) : (
        <Stack spacing={2}>
          {!hasCurrent && (
            <Card variant="outlined">
              <CardContent>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <SavingsOutlined color="action" />
                    <Typography>You have no budget for {formatMonth(thisMonth)}.</Typography>
                  </Stack>
                  <Button variant="outlined" onClick={() => setDialog({ open: true, month: thisMonth })}>
                    Create it now
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}
          <Grid container spacing={2}>
            {budgets.map((budget) => (
              <Grid key={budget.id} size={{ xs: 12, md: 6 }}>
                <PersonalBudgetCard
                  budget={budget}
                  actions={
                    <>
                      <Tooltip title="Edit">
                        <IconButton aria-label={`Edit budget for ${formatMonth(budget.month)}`} onClick={() => setDialog({ open: true, budget })}>
                          <EditOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton aria-label={`Delete budget for ${formatMonth(budget.month)}`} color="error" onClick={() => handleDelete(budget)}>
                          <DeleteOutlineOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  }
                />
              </Grid>
            ))}
          </Grid>
        </Stack>
      )}

      <PersonalBudgetDialog
        open={dialog.open}
        budget={dialog.open ? dialog.budget : undefined}
        defaultMonth={dialog.open ? dialog.month : undefined}
        onClose={() => setDialog({ open: false })}
        onSaved={(message) => {
          setDialog({ open: false });
          setNotice(message);
        }}
      />

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={3000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setNotice(null)}>{notice}</Alert>
      </Snackbar>
    </Stack>
  );
}
