import { Card, CardContent, Stack, Typography } from "@mui/material";
import { CheckCircleOutlineOutlined, ErrorOutlineOutlined, WarningAmberOutlined } from "@mui/icons-material";

import { formatCurrency } from "../../../utils/currency";
import { formatDate } from "../../../utils/format";
import type { BudgetScopeForecast } from "../types/budget";
import { forecastSummary } from "../utils/forecastText";
import { BudgetForecastChart } from "./BudgetForecastChart";

interface BudgetForecastPanelProps {
  forecast: BudgetScopeForecast;
  startDate: string;
  endDate: string;
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="subtitle1">{value}</Typography>
    </Stack>
  );
}

/**
 * The viewer's level of an active budget (§28.19): where spend is heading,
 * in words and figures, with committed spend kept apart from spend.
 */
export function BudgetForecastPanel({ forecast, startDate, endDate }: BudgetForecastPanelProps) {
  const { status, projectedAmount, expectedByToday } = forecast.forecast;
  const summary = forecastSummary(forecast.forecast, endDate);

  return (
    <Card component="section" aria-labelledby="budget-forecast-title">
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography id="budget-forecast-title" variant="h6" component="h2">Forecast</Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              {status === "ON_TRACK" ? (
                <CheckCircleOutlineOutlined fontSize="small" color="success" aria-hidden="true" />
              ) : status === "PROJECTED_OVER" ? (
                <WarningAmberOutlined fontSize="small" color="warning" aria-hidden="true" />
              ) : (
                <ErrorOutlineOutlined fontSize="small" color="error" aria-hidden="true" />
              )}
              <Typography variant="body1">{summary}</Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={4} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Figure label="Budget" value={formatCurrency(forecast.allocated)} />
            <Figure label="Reimbursed spend" value={formatCurrency(forecast.spentAmount)} />
            <Figure label="Committed" value={formatCurrency(forecast.committedAmount)} />
            <Figure label={`Projected by ${formatDate(endDate)}`} value={projectedAmount === null ? "After the first week" : formatCurrency(projectedAmount)} />
            <Figure label="Even pace by today" value={formatCurrency(expectedByToday)} />
          </Stack>

          <BudgetForecastChart forecast={forecast} startDate={startDate} endDate={endDate} summary={summary} />

          <Typography variant="body2" color="text.secondary">
            Spend includes reimbursed expenses only. Committed spend is approved and awaiting reimbursement; the projection uses both at the pace so far. Expenses awaiting approval are not counted.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
