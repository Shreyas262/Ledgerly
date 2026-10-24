import { formatDate } from "../../../utils/format";
import { EXPENSE_TYPE_LABELS } from "../types/expense";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Card,
  CardContent,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import type { Expense } from "../types/expense";

import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { useAuth } from "../../../features/auth/context/AuthContext";
import { Amount } from "../../../components/common/Amount";
import { ConversionNote } from "../../currency/components/ConversionNote";
import { ExpenseStatusChip } from "./ExpenseStatusChip";

interface ExpenseCardProps {
  expense: Expense;
  variant?: "default" | "approval";
  onView: (expense: Expense) => void;
  onSubmit?: (expense: Expense) => void;
  onStartReview?: (expense: Expense) => void;
  isSubmitting?: boolean;
  isStartingReview?: boolean;
  /** Selection for submitting several drafts at once; offered only on drafts that can be submitted. */
  selected?: boolean;
  onSelectedChange?: (expense: Expense, selected: boolean) => void;
}

export function ExpenseCard({
  expense,
  variant = "default",
  onView,
  onSubmit,
  onStartReview,
  isSubmitting = false,
  isStartingReview = false,
  selected = false,
  onSelectedChange,
}: ExpenseCardProps) {
  const policyFlags = {
    escalated: expense.policyEvaluation?.details.escalated === true,
    warnings: expense.policyEvaluation?.details.warnings?.length ?? 0,
  };
  const { can } = usePermissions();
  const { user } = useAuth();

  const canSubmit =
    variant === "default" &&
    expense.status === "draft" &&
    expense.employeeId === user?.id &&
    can("expenses.submit");

  // Like the Submit button, selection needs a receipt (§21.14).
  const canSelect = Boolean(onSelectedChange) && canSubmit && Boolean(expense.documentIds?.length);

  const canStartReview =
    variant === "approval" &&
    expense.employeeId !== user?.id &&
    expense.status === "submitted" &&
    can("expenses.approve");

  return (
    <Card>
      <CardContent>
      <Stack spacing={2}>
        <Box
          sx={{
            display: "flex",
            flexDirection: {
              xs: "column",
              sm: "row",
            },
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
          {canSelect && (
            <Checkbox
              checked={selected}
              onChange={(event) => onSelectedChange?.(expense, event.target.checked)}
              slotProps={{ input: { "aria-label": `Select ${expense.title}` } }}
              sx={{ mt: -0.75, ml: -1 }}
            />
          )}
          <Stack spacing={0.5}>
            <Typography variant="subtitle1">
              {expense.title}
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
            >
              {EXPENSE_TYPE_LABELS[expense.type] ?? expense.type}
            </Typography>

            {expense.employeeId !== user?.id && expense.employeeName && (
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Submitted by {expense.employeeName}
                {expense.employeeRemoved ? " (removed)" : ""}
              </Typography>
            )}

            {expense.status === "under_review" && expense.reviewStartedByName && (
              <Typography
                variant="body2"
                color="text.secondary"
              >
                In review by {expense.reviewStartedBy === user?.id ? "you" : expense.reviewStartedByName}
              </Typography>
            )}

            <Typography
              variant="body2"
              color="text.secondary"
            >
              {expense.teamName ?? "—"} · {expense.departmentName ?? "—"}
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
            >
              {formatDate(expense.expenseDate)}
            </Typography>
          </Stack>
          </Stack>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: {
                xs: "flex-start",
                sm: "flex-end",
              },
              gap: 1,
            }}
          >
            <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
              <Typography variant="h6">
                <Amount value={expense.amount} currency={expense.currency} />
              </Typography>
              <ConversionNote conversion={expense.conversion} />
            </Box>

            <ExpenseStatusChip status={expense.status} />

            {/* Policy flags for reviewers (§21.10, §22.3). */}
            {variant === "approval" && (policyFlags.escalated || policyFlags.warnings > 0) && (
              <Stack direction="row" spacing={0.75}>
                {policyFlags.escalated && <Chip size="small" color="info" variant="outlined" label="Above policy threshold" />}
                {policyFlags.warnings > 0 && (
                  <Chip size="small" color="warning" variant="outlined" label={`${policyFlags.warnings} policy ${policyFlags.warnings === 1 ? "warning" : "warnings"}`} />
                )}
              </Stack>
            )}
          </Box>
        </Box>

        <Stack
          direction={{
            xs: "column",
            sm: "row",
          }}
          spacing={1}
          sx={{
            justifyContent: "flex-end",
          }}
        >
          <Button
            variant="outlined"
            onClick={() => onView(expense)}
          >
            View
          </Button>

          {canSubmit && (
            // A disabled button gets no pointer events; the wrapper shows why it is disabled.
            <Tooltip title={expense.documentIds?.length ? "" : "Attach a receipt before submitting."}>
              <span>
                <Button
                  variant="contained"
                  onClick={() => onSubmit?.(expense)}
                  loading={isSubmitting}
                  disabled={!expense.documentIds?.length}
                >
                  {expense.documentIds?.length ? "Submit" : "Receipt Required"}
                </Button>
              </span>
            </Tooltip>
          )}

          {canStartReview && (
            <Button
              variant="contained"
              onClick={() =>
                onStartReview?.(expense)
              }
              loading={isStartingReview}
            >
              Start Review
            </Button>
          )}
        </Stack>
      </Stack>
      </CardContent>
    </Card>
  );
}