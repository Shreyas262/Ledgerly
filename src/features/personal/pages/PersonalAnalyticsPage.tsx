import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";

import { PageHeader } from "../../../components/common/PageHeader";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { RefreshingState } from "../../../components/common/RefreshingState";
import { ChartCard } from "../../../components/common/ChartCard";
import { Amount } from "../../../components/common/Amount";
import { FilterBar } from "../../../components/common/FilterBar";
import { KpiCard } from "../../dashboard/components/KpiCard";
import { formatChartCurrency, formatCompactCurrency } from "../../analytics/utils/chartFormat";
import { formatCurrency } from "../../../utils/currency";
import { formatDate } from "../../../utils/format";
import { useGetPersonalAnalyticsQuery } from "../api/personalApi";
import { PAYMENT_METHOD_LABELS, PERSONAL_EXPENSE_TYPE_LABELS } from "../types/personal";
import { PersonalTypeBreakdownChart } from "../components/PersonalTypeBreakdownChart";
import { currentMonth, formatMonth, shiftMonth } from "../utils/personalFormat";

type RangePreset = "3" | "6" | "12" | "custom";
const DEFAULT_PRESET: RangePreset = "6";

export function PersonalAnalyticsPage() {
  const { palette } = useTheme();
  const thisMonth = currentMonth();
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [customFrom, setCustomFrom] = useState(shiftMonth(thisMonth, -5));
  const [customTo, setCustomTo] = useState(thisMonth);

  const from = preset === "custom" ? customFrom : shiftMonth(thisMonth, -(Number(preset) - 1));
  const to = preset === "custom" ? customTo : thisMonth;
  const rangeError = !from || !to
    ? "Choose both months."
    : from > to
      ? "The start month must be on or before the end month."
      : null;

  const { data, isLoading, isFetching, isError, error, refetch } = useGetPersonalAnalyticsQuery(
    { from, to },
    { skip: Boolean(rangeError), refetchOnMountOrArgChange: true },
  );

  const hasBudgets = data?.monthly.some((point) => point.budget !== null) ?? false;
  const methodTotal = data?.byPaymentMethod.reduce((sum, item) => sum + item.amount, 0) ?? 0;

  return (
    <Stack spacing={3}>
      <PageHeader title="Spending Analytics" description="How your spending changes over time and where it goes." />

      <FilterBar
        label="Analytics range"
        activeCount={preset === DEFAULT_PRESET ? 0 : 1}
        onReset={() => setPreset(DEFAULT_PRESET)}
        error={rangeError}
      >
        <TextField select size="small" label="Period" value={preset} onChange={(event) => setPreset(event.target.value as RangePreset)}>
          <MenuItem value="3">Last 3 months</MenuItem>
          <MenuItem value="6">Last 6 months</MenuItem>
          <MenuItem value="12">Last 12 months</MenuItem>
          <MenuItem value="custom">Custom range</MenuItem>
        </TextField>
        {preset === "custom" && (
          <TextField
            size="small"
            type="month"
            label="From"
            value={customFrom}
            onChange={(event) => setCustomFrom(event.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: thisMonth } }}
          />
        )}
        {preset === "custom" && (
          <TextField
            size="small"
            type="month"
            label="To"
            value={customTo}
            onChange={(event) => setCustomTo(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
      </FilterBar>

      {rangeError ? null : isLoading ? (
        <LoadingState message="Loading analytics…" />
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          {isFetching && <RefreshingState />}
          <Typography variant="body2" color="text.secondary">
            {formatMonth(data.from)} – {formatMonth(data.to)}
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard label="Total spent" value={formatCurrency(data.total)} description={`${data.count} ${data.count === 1 ? "expense" : "expenses"}`} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard label="Average per month" value={formatCurrency(data.averagePerMonth, { maximumFractionDigits: 0 })} description={`Over ${data.monthly.length} ${data.monthly.length === 1 ? "month" : "months"}`} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard
                label="Top type"
                value={data.byType[0] ? PERSONAL_EXPENSE_TYPE_LABELS[data.byType[0].type] : "—"}
                description={data.byType[0] && data.total ? `${((data.byType[0].amount / data.total) * 100).toFixed(0)}% of spending` : "No spending yet"}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiCard
                label="Largest expense"
                value={data.largestExpense ? formatCurrency(data.largestExpense.amount) : "—"}
                description={data.largestExpense ? `${data.largestExpense.description} · ${formatDate(data.largestExpense.expenseDate)}` : "No spending yet"}
              />
            </Grid>
          </Grid>

          <ChartCard
            title="Monthly spending"
            subtitle={hasBudgets ? "Spending compared with your monthly budget" : "Spending per month"}
            isEmpty={data.total === 0}
            emptyMessage="No spending in this period."
            minHeight={300}
          >
            <BarChart
              height={300}
              xAxis={[{ scaleType: "band", data: data.monthly.map((point) => formatMonth(point.month, true)) }]}
              yAxis={[{ valueFormatter: formatCompactCurrency, width: 64 }]}
              series={[
                { label: "Spent", data: data.monthly.map((point) => point.amount), color: palette.chart.series, valueFormatter: formatChartCurrency },
                ...(hasBudgets
                  ? [{ label: "Budget", data: data.monthly.map((point) => point.budget), color: palette.chart.reference, valueFormatter: formatChartCurrency }]
                  : []),
              ]}
              grid={{ horizontal: true }}
              borderRadius={4}
              hideLegend={!hasBudgets}
              margin={{ top: 16, right: 16 }}
            />
          </ChartCard>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <PersonalTypeBreakdownChart data={data.byType} subtitle="Share of spending in this period" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h6">By payment method</Typography>
                      <Typography variant="body2" color="text.secondary">How you paid in this period</Typography>
                    </Box>
                    {data.byPaymentMethod.length === 0 ? (
                      <Typography color="text.secondary">No spending in this period.</Typography>
                    ) : (
                      data.byPaymentMethod.map((item) => {
                        const share = methodTotal ? (item.amount / methodTotal) * 100 : 0;
                        return (
                          <Box key={item.paymentMethod}>
                            <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
                              <Typography variant="body2">
                                {PAYMENT_METHOD_LABELS[item.paymentMethod]}
                                <Typography component="span" variant="caption" color="text.secondary"> · {item.count}</Typography>
                              </Typography>
                              <Typography variant="subtitle2"><Amount value={item.amount} /></Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={share}
                              sx={{ height: 6, mt: 0.5 }}
                              aria-label={`${PAYMENT_METHOD_LABELS[item.paymentMethod]}: ${share.toFixed(0)}%`}
                            />
                          </Box>
                        );
                      })
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Stack>
  );
}
