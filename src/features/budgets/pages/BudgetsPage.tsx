import { useMemo } from "react";
import {
  Button,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useGetBudgetsQuery } from "../api/budgetsApi";
import { BudgetCard } from "../components/BudgetCard";
import { BudgetSummaryCard } from "../components/BudgetSummaryCard";
import { calculateBudgetSummary } from "../utils/calculateBudgetSummary";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { usePermissions } from "../../auth/hooks/usePermissions";
import { AddOutlined } from "@mui/icons-material";

export function BudgetsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const {
    data: budgets,
    isLoading,
    isError,
  } = useGetBudgetsQuery();

  const summary = useMemo(
    () => calculateBudgetSummary(budgets ?? []),
    [budgets],
  );

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState />;
  }


  return (
    <Stack spacing={3}>
      <Stack
        direction={{
          xs: "column",
          sm: "row",
        }}
        sx={{
          justifyContent: "space-between",
          alignItems: {
            xs: "flex-start",
            sm: "center",
          },
          gap: 2,
        }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h4">
            Budgets
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
          >
            Monitor organizational spending against allocated budgets.
          </Typography>
        </Stack>

        {can("budgets.create") && (
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => navigate("/budgets/new")}
          >
            Create Budget
          </Button>
        )}
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <BudgetSummaryCard
            label="Total Budget"
            value={`₹${summary.totalBudget.toLocaleString(
              "en-IN",
            )}`}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <BudgetSummaryCard
            label="Total Spent"
            value={`₹${summary.totalSpent.toLocaleString(
              "en-IN",
            )}`}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <BudgetSummaryCard
            label="Remaining"
            value={`₹${summary.totalRemaining.toLocaleString(
              "en-IN",
            )}`}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <BudgetSummaryCard
            label="Utilization"
            value={`${summary.utilization.toFixed(1)}%`}
            description="Across all budgets"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {(budgets ?? []).map((budget) => (
          <Grid
            key={budget.id}
            size={{ xs: 12, md: 6, lg: 4 }}
          >
            <BudgetCard
              budget={budget}
              onView={(selectedBudget) =>
                navigate(
                  `/budgets/${selectedBudget.id}`,
                )
              }
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}