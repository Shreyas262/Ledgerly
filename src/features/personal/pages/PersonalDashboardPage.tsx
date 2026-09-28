import type { ReactNode } from "react";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import {
  AddOutlined,
  AssessmentOutlined,
  ReceiptLongOutlined,
  SavingsOutlined,
} from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";

import { PageHeader } from "../../../components/common/PageHeader";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { RefreshingState } from "../../../components/common/RefreshingState";
import { Amount } from "../../../components/common/Amount";
import { KpiCard } from "../../dashboard/components/KpiCard";
import { useAuth } from "../../auth/context/AuthContext";
import { formatCurrency } from "../../../utils/currency";
import { formatDate } from "../../../utils/format";
import { useGetPersonalSummaryQuery } from "../api/personalApi";
import { PAYMENT_METHOD_LABELS, PERSONAL_EXPENSE_TYPE_LABELS } from "../types/personal";
import { PersonalBudgetCard } from "../components/PersonalBudgetCard";
import { PersonalTypeBreakdownChart } from "../components/PersonalTypeBreakdownChart";
import { formatMonth } from "../utils/personalFormat";

function changeDescription(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "No spending last month either" : "Nothing spent last month";
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.5) return "Same as last month";
  return `${Math.abs(change).toFixed(0)}% ${change > 0 ? "more" : "less"} than last month`;
}

function QuickAction({ to, icon, label, description }: { to: string; icon: ReactNode; label: string; description: string }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardActionArea component={RouterLink} to={to} sx={{ height: "100%" }}>
        <CardContent>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Box sx={{ display: "flex", p: 1, borderRadius: 1.5, bgcolor: "action.hover", color: "primary.main" }}>{icon}</Box>
            <Stack sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2">{label}</Typography>
              <Typography variant="body2" color="text.secondary" noWrap>{description}</Typography>
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export function PersonalDashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading, isFetching, isError, error, refetch } = useGetPersonalSummaryQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const firstName = user?.name.split(" ")[0];

  return (
    <Stack spacing={3}>
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : "Dashboard"}
        description={summary ? `Your spending for ${formatMonth(summary.month)}.` : "Your spending at a glance."}
        actions={
          <Button component={RouterLink} to="/personal/expenses/new" variant="contained" startIcon={<AddOutlined />}>
            Add Expense
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState message="Loading your summary…" />
      ) : isError || !summary ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          {isFetching && <RefreshingState />}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard
                label="Spent this month"
                value={formatCurrency(summary.monthSpent)}
                description={changeDescription(summary.monthSpent, summary.previousMonthSpent)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard
                label="Budget remaining"
                value={summary.budget ? formatCurrency(Math.max(summary.budget.remaining, 0)) : "—"}
                description={
                  !summary.budget
                    ? "No budget set for this month"
                    : summary.budget.remaining < 0
                      ? `Over budget by ${formatCurrency(-summary.budget.remaining)}`
                      : `${summary.budget.utilizationPercent.toFixed(0)}% of ${formatCurrency(summary.budget.amount)} used`
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard
                label="Expenses this month"
                value={summary.monthCount}
                description={summary.monthCount ? `Average ${formatCurrency(summary.monthSpent / summary.monthCount, { maximumFractionDigits: 0 })}` : "Nothing recorded yet"}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard
                label="Top type"
                value={summary.byType[0] ? PERSONAL_EXPENSE_TYPE_LABELS[summary.byType[0].type] : "—"}
                description={summary.byType[0] ? `${formatCurrency(summary.byType[0].amount)} this month` : "No spending yet"}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <QuickAction to="/personal/expenses/new" icon={<AddOutlined />} label="Add expense" description="Record a new purchase" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <QuickAction to="/personal/expenses" icon={<ReceiptLongOutlined />} label="All expenses" description="Search and filter" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <QuickAction to="/personal/budgets" icon={<SavingsOutlined />} label="Budgets" description={summary.budget ? "Review your limits" : "Set this month's budget"} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <QuickAction to="/personal/analytics" icon={<AssessmentOutlined />} label="Analytics" description="Trends and breakdowns" />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              {summary.budget ? (
                <PersonalBudgetCard budget={summary.budget} />
              ) : (
                <Card sx={{ height: "100%" }}>
                  <CardContent>
                    <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
                      <Typography variant="h6">{formatMonth(summary.month)} budget</Typography>
                      <Typography color="text.secondary">
                        Set a monthly budget to see how much you have left to spend.
                      </Typography>
                      <Button component={RouterLink} to="/personal/budgets" variant="outlined" startIcon={<SavingsOutlined />}>
                        Create a budget
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <PersonalTypeBreakdownChart
                data={summary.byType}
                subtitle={formatMonth(summary.month)}
                emptyMessage="No spending recorded this month."
              />
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="h6">Recent transactions</Typography>
                {summary.recent.length > 0 && (
                  <Button component={RouterLink} to="/personal/expenses" size="small">View all</Button>
                )}
              </Stack>
              {summary.recent.length === 0 ? (
                <Stack spacing={1.5} sx={{ alignItems: "flex-start", py: 2 }}>
                  <Typography color="text.secondary">You have not recorded any expenses yet.</Typography>
                  <Button component={RouterLink} to="/personal/expenses/new" variant="contained" startIcon={<AddOutlined />}>
                    Add your first expense
                  </Button>
                </Stack>
              ) : (
                <List component="div" disablePadding>
                  {summary.recent.map((expense, index) => (
                    <Box key={expense.id}>
                      {index > 0 && <Divider />}
                      <ListItemButton component={RouterLink} to={`/personal/expenses/${expense.id}`} sx={{ px: 1, borderRadius: 1 }}>
                        <ListItemText
                          primary={expense.description}
                          secondary={`${formatDate(expense.expenseDate)} · ${PERSONAL_EXPENSE_TYPE_LABELS[expense.type]} · ${PAYMENT_METHOD_LABELS[expense.paymentMethod]}`}
                          slotProps={{ primary: { noWrap: true } }}
                          sx={{ minWidth: 0, mr: 2 }}
                        />
                        <Typography variant="subtitle2" sx={{ flexShrink: 0 }}>
                          <Amount value={expense.amount} />
                        </Typography>
                      </ListItemButton>
                    </Box>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  );
}
