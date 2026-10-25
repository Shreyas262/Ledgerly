import { Box, useTheme } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import { ChartsReferenceLine } from "@mui/x-charts/ChartsReferenceLine";

import { formatCurrency } from "../../../utils/currency";
import { formatDate, toDateOnly } from "../../../utils/format";
import type { BudgetScopeForecast } from "../types/budget";

interface BudgetForecastChartProps {
  forecast: BudgetScopeForecast;
  startDate: string;
  endDate: string;
  /** The forecast in words; the chart's accessible description. */
  summary: string;
}

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const axisCurrency = (value: number | null) => `₹${compact.format(value ?? 0)}`;
const tooltipCurrency = (value: number | null) => (value === null ? null : formatCurrency(value));
const toDate = (date: string) => new Date(`${date}T00:00:00`);

/**
 * Spend building up through the period (§28.19): reimbursed spend, reimbursed
 * plus committed spend as its own line, the projection to the period end
 * dashed, and the allocation as a reference line.
 */
export function BudgetForecastChart({ forecast, startDate, endDate, summary }: BudgetForecastChartProps) {
  const { palette } = useTheme();
  const [spentColor, committedColor] = palette.chart.categorical;
  const points = forecast.trend;
  const last = points.at(-1);
  const projected = forecast.forecast.projectedAmount;

  // From zero at the period start, through today, then on to the period end.
  const fromZero = points.length > 0 && points[0].date > startDate;
  const toEnd = projected !== null && last !== undefined && last.date < endDate;
  const dates = [...(fromZero ? [startDate] : []), ...points.map((point) => point.date), ...(toEnd ? [endDate] : [])];
  const spent = [...(fromZero ? [0] : []), ...points.map((point) => point.spentAmount), ...(toEnd ? [null] : [])];
  const used = [...(fromZero ? [0] : []), ...points.map((point) => point.spentAmount + point.committedAmount), ...(toEnd ? [null] : [])];
  const projection = dates.map((_date, index) =>
    toEnd && index === dates.length - 2 ? used[index] : toEnd && index === dates.length - 1 ? projected : null);
  const highest = Math.max(forecast.allocated, projected ?? 0, ...used.map((value) => value ?? 0));

  return (
    <Box role="img" aria-label={`Budget forecast chart. ${summary}`} sx={{ minWidth: 0 }}>
      <LineChart
        height={300}
        series={[
          { id: "spent", label: "Reimbursed", data: spent, color: spentColor, showMark: false, valueFormatter: tooltipCurrency },
          { id: "committed", label: "Reimbursed and committed", data: used, color: committedColor, showMark: false, valueFormatter: tooltipCurrency },
          ...(toEnd
            // Neutral and dashed: a projection, not spend.
            ? [{ id: "projected", label: "Projected", data: projection, color: palette.chart.other, showMark: false, valueFormatter: tooltipCurrency }]
            : []),
        ]}
        xAxis={[{
          scaleType: "time",
          data: dates.map(toDate),
          min: toDate(startDate),
          max: toDate(endDate),
          tickNumber: 6,
          valueFormatter: (value: Date, context) =>
            context.location === "tick" ? formatDate(toDateOnly(value)).replace(/ \d{4}$/, "") : formatDate(toDateOnly(value)),
        }]}
        yAxis={[{ min: 0, max: highest * 1.1, valueFormatter: axisCurrency, width: 64 }]}
        grid={{ horizontal: true }}
        margin={{ top: 16, right: 28 }}
        // A dashed line marks the projection, and only the projection.
        sx={{ "& path[data-series='projected']": { strokeDasharray: "6 4" } }}
      >
        <ChartsReferenceLine
          y={forecast.allocated}
          label={`Budget ${formatCurrency(forecast.allocated)}`}
          labelAlign="start"
          lineStyle={{ stroke: palette.chart.reference, strokeWidth: 2 }}
          labelStyle={{ fill: palette.text.secondary, fontSize: 12 }}
        />
      </LineChart>
    </Box>
  );
}
