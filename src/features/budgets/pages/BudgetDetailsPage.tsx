import {
  Button,
  capitalize,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowBackOutlined } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";

import { useGetBudgetByIdQuery } from "../api/budgetsApi";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { usePermissions } from "../../auth/hooks/usePermissions";
import {
  calculateBudgetRemaining,
  calculateBudgetUtilization,
  calculateBudgetStatus,
} from "../utils/budgetCalculations";

export function BudgetDetailsPage() {
  const navigate = useNavigate();

  const { id } = useParams<{ id: string }>();
  const { can } = usePermissions();

  const {
    data: budget,
    isLoading,
    isError,
  } = useGetBudgetByIdQuery(id ?? "", {
    skip: !id,
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !budget) {
    return <ErrorState />;
  }

  const remainingAmount = calculateBudgetRemaining(budget);
  const utilization = calculateBudgetUtilization(budget);
  const status = calculateBudgetStatus(budget);

  return (
    <Stack spacing={3}>
      <Button
        startIcon={<ArrowBackOutlined />}
        onClick={() => navigate(-1)}
        sx={{
          alignSelf: "flex-start",
        }}
      >
        Back to Budgets
      </Button>

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
            {budget.name}
          </Typography>

          {budget.description && (
            <Typography
              color="text.secondary"
            >
              {budget.description}
            </Typography>
          )}
        </Stack>

        <Chip label={capitalize(status)} />
      </Stack>
      
      {can("budgets.update") && (
        <Button
          variant="contained"
          onClick={() =>
            navigate(`/budgets/${budget.id}/edit`)
          }
          sx={{maxWidth: "30vw"}}
        >
          Edit Budget
        </Button>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Budget
                </Typography>

                <Typography variant="h5">
                  ₹
                  {budget.amount.toLocaleString(
                    "en-IN",
                  )}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Spent
                </Typography>

                <Typography variant="h5">
                  ₹
                  {budget.spentAmount.toLocaleString(
                    "en-IN",
                  )}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Remaining
                </Typography>

                <Typography variant="h5">
                  ₹
                  {remainingAmount.toLocaleString(
                    "en-IN",
                  )}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Utilization
                </Typography>

                <Typography variant="h5">
                  {utilization.toFixed(1)}%
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">
              Budget Information
            </Typography>

            <Divider />

            <Stack spacing={1}>
              {budget.department && (
                <Typography>
                  <strong>Department:</strong>{" "}
                  {budget.department}
                </Typography>
              )}

              {budget.project && (
                <Typography>
                  <strong>Project:</strong>{" "}
                  {budget.project}
                </Typography>
              )}

              <Typography>
                <strong>Start Date:</strong>{" "}
                {budget.startDate}
              </Typography>

              <Typography>
                <strong>End Date:</strong>{" "}
                {budget.endDate}
              </Typography>

              <Typography>
                <strong>Currency:</strong>{" "}
                {budget.currency}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      
    </Stack>
  );
}