import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
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
  ArrowForwardOutlined,
  AssessmentOutlined,
  ChevronRightOutlined,
  ReceiptLongOutlined,
  SavingsOutlined,
} from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";

import { PageHeader } from "../../../components/common/PageHeader";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { RefreshingState } from "../../../components/common/RefreshingState";
import { FloatingAction } from "../../../components/common/FloatingAction";
import { PlusIcon } from "../../../components/common/PlusIcon";
import { TruncatedText } from "../../../components/common/TruncatedText";
import { Amount } from "../../../components/common/Amount";
import { ConversionNote } from "../../currency/components/ConversionNote";
import { KpiCard } from "../../dashboard/components/KpiCard";
import { useAuth } from "../../auth/hooks/useAuth";
import { formatCurrency } from "../../../utils/currency";
import { formatDate } from "../../../utils/format";
import { useGetPersonalSummaryQuery } from "../api/personalApi";
import { PAYMENT_METHOD_LABELS, PERSONAL_EXPENSE_TYPE_LABELS } from "../types/personal";
import { PersonalBudgetCard } from "../components/PersonalBudgetCard";
import { PersonalTypeBreakdownChart } from "../components/PersonalTypeBreakdownChart";
import { formatMonth } from "../utils/personalFormat";

/** First and last calendar dates of a YYYY-MM month. */
function monthBounds(month: string): { dateFrom: string; dateTo: string } {
  const [year, monthIndex] = month.split("-").map(Number);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return { dateFrom: `${month}-01`, dateTo: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function changeDescription(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "No spending last month either" : "Nothing spent last month";
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.5) return "Same as last month";
  return `${Math.abs(change).toFixed(0)}% ${change > 0 ? "more" : "less"} than last month`;
}

function QuickAction({ to, icon, label, primary = false }: { to: string; icon: ReactNode; label: string; primary?: boolean }) {
  return (
    <Button
      component={RouterLink}
      to={to}
      variant={primary ? "contained" : "outlined"}
      size="large"
      startIcon={icon}
      endIcon={<ChevronRightOutlined />}
      fullWidth
      // Equal heights when one label wraps onto two lines.
      sx={{ height: "100%", justifyContent: "flex-start", textAlign: "left", "& .MuiButton-endIcon": { ml: "auto" } }}
    >
      {label}
    </Button>
  );
}

export function PersonalDashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading, isFetching, isError, error, refetch } = useGetPersonalSummaryQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const firstName = user?.name.split(" ")[0];

  return (
    <Stack spacing={3} sx={{ pb: 10 }}>
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : "Dashboard"}
        description={summary ? `Your spending for ${formatMonth(summary.month)}.` : "Your spending at a glance."}
      />

      {isLoading ? (
        <LoadingState message="Loading your summary…" />
      ) : isError || !summary ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          {isFetching && <RefreshingState />}

          <Card component="section" aria-labelledby="quick-actions-title">
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography id="quick-actions-title" variant="h6">Quick actions</Typography>
                  <Typography variant="body2" color="text.secondary">Jump to common tasks.</Typography>
                </Box>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <QuickAction to="/personal/expenses/new" icon={<AddOutlined />} label="Add expense" primary />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <QuickAction to="/personal/expenses" icon={<ReceiptLongOutlined />} label="View expenses" />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <QuickAction
                      to="/personal/budgets"
                      icon={<SavingsOutlined />}
                      label={summary.budget ? "Review budget" : "Set this month's budget"}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <QuickAction to="/personal/analytics" icon={<AssessmentOutlined />} label="View analytics" />
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard
                label="Spent this month"
                value={formatCurrency(summary.monthSpent)}
                description={changeDescription(summary.monthSpent, summary.previousMonthSpent)}
                sparkline={summary.trend.map((point) => point.amount)}
                sparklineLabel={`Spending over the last six months: ${summary.trend
                  .map((point) => `${formatMonth(point.month)} ${formatCurrency(point.amount)}`)
                  .join(", ")}`}
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

          {summary.missingReceipts > 0 && (
            <Alert
              severity="info"
              action={
                <Button
                  component={RouterLink}
                  to="/personal/expenses"
                  state={{ filters: { receipt: "missing", ...monthBounds(summary.month) } }}
                  variant="outlined"
                  color="inherit"
                  size="small"
                  endIcon={<ArrowForwardOutlined />}
                >
                  Review Expenses
                </Button>
              }
            >
              {summary.missingReceipts === 1
                ? "1 expense this month has no receipt."
                : `${summary.missingReceipts} expenses this month have no receipt.`}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              {summary.budget ? (
                <PersonalBudgetCard budget={summary.budget} pace={summary.pace} />
              ) : (
                <Card sx={{ height: "100%" }}>
                  <CardContent>
                    <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
                      <Typography variant="h6">{formatMonth(summary.month)} budget</Typography>
                      <Typography color="text.secondary">
                        Set a monthly budget to see how much you have left to spend.
                      </Typography>
                      <Button component={RouterLink} to="/personal/budgets" variant="outlined" startIcon={<SavingsOutlined />}>
                        Create a Budget
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
                  <Button component={RouterLink} to="/personal/expenses" size="small">View All</Button>
                )}
              </Stack>
              {summary.recent.length === 0 ? (
                <Stack spacing={1.5} sx={{ alignItems: "flex-start", py: 2 }}>
                  <Typography color="text.secondary">You have not recorded any expenses yet.</Typography>
                  <Button component={RouterLink} to="/personal/expenses/new" variant="contained" startIcon={<AddOutlined />}>
                    Add Your First Expense
                  </Button>
                </Stack>
              ) : (
                <List component="div" disablePadding>
                  {summary.recent.map((expense, index) => (
                    <Box key={expense.id}>
                      {index > 0 && <Divider />}
                      <ListItemButton component={RouterLink} to={`/personal/expenses/${expense.id}`} sx={{ px: 1, borderRadius: 1 }}>
                        <ListItemText
                          primary={<TruncatedText component="span" variant="inherit">{expense.description}</TruncatedText>}
                          secondary={`${formatDate(expense.expenseDate)} · ${PERSONAL_EXPENSE_TYPE_LABELS[expense.type]} · ${PAYMENT_METHOD_LABELS[expense.paymentMethod]}`}
                          sx={{ minWidth: 0, mr: 2 }}
                        />
                        <Box sx={{ flexShrink: 0, textAlign: "right" }}>
                          <Typography variant="subtitle2">
                            <Amount value={expense.amount} />
                          </Typography>
                          <ConversionNote conversion={expense.conversion} />
                        </Box>
                      </ListItemButton>
                    </Box>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <FloatingAction label="Add Expense" to="/personal/expenses/new" icon={<PlusIcon sx={{ fontSize: 28 }} />} />
    </Stack>
  );
}
