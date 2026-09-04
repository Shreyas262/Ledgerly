import {
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";

import type { Budget } from "../../../types/budget";
import {
  calculateBudgetRemaining,
  calculateBudgetUtilization,
} from "../utils/budgetCalculations";

interface BudgetCardProps {
  budget: Budget;
  onView: (budget: Budget) => void;
}

export function BudgetCard({
  budget,
  onView,
}: BudgetCardProps) {

  const remainingAmount = calculateBudgetRemaining(budget);
  const utilization = calculateBudgetUtilization(budget);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 2,
            }}
          >
            <Stack spacing={0.5}>
              <Typography variant="h6">
                {budget.name}
              </Typography>

              {budget.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  {budget.description}
                </Typography>
              )}
            </Stack>

            <Chip
              label={budget.status}
              size="small"
            />
          </Stack>

          <Stack spacing={1}>
            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Typography variant="body2">
                Spent
              </Typography>

              <Typography variant="body2">
                ₹
                {budget.spentAmount.toLocaleString(
                  "en-IN",
                )}
                {" / "}
                ₹
                {budget.amount.toLocaleString(
                  "en-IN",
                )}
              </Typography>
            </Stack>

            <LinearProgress
              variant="determinate"
              value={utilization}
            />

            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
              >
                {utilization.toFixed(1)}% utilized
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
              >
                ₹
                {remainingAmount.toLocaleString(
                  "en-IN",
                )}{" "}
                remaining
              </Typography>
            </Stack>
          </Stack>

          <Stack spacing={0.5}>
            {budget.department && (
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Department: {budget.department}
              </Typography>
            )}

            {budget.project && (
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Project: {budget.project}
              </Typography>
            )}
          </Stack>

          <Typography
            component="button"
            onClick={() => onView(budget)}
            sx={{
              border: 0,
              background: "none",
              padding: 0,
              textAlign: "left",
              cursor: "pointer",
              color: "primary.main",
              font: "inherit",
            }}
          >
            View budget
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}