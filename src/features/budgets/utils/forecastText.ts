import { formatCurrency } from "../../../utils/currency";
import { formatDate } from "../../../utils/format";
import type { BudgetForecast } from "../types/budget";

/**
 * The forecast in a full sentence (§28.19), for the forecast panel:
 * "At this pace, spend will reach ₹5,00,000 by 31 Dec 2026, within budget."
 */
export function forecastSummary(forecast: BudgetForecast, endDate: string): string {
  if (forecast.status === "OVER_COMMITTED") {
    return `Reimbursed and approved spend is already ${formatCurrency(forecast.overBy)} over the budget.`;
  }
  if (forecast.projectedAmount === null) {
    return "A projection appears after the first week of the period.";
  }
  const reach = `At this pace, spend will reach ${formatCurrency(forecast.projectedAmount)} by ${formatDate(endDate)}`;
  return forecast.status === "PROJECTED_OVER"
    ? `${reach}, ${formatCurrency(forecast.overBy)} over budget.${forecast.runsOutOn ? ` The budget runs out around ${formatDate(forecast.runsOutOn)}.` : ""}`
    : `${reach}, within budget.`;
}

/** A short warning for a level that is not on track, or null when it is. */
export function forecastWarning(forecast: BudgetForecast | null | undefined): string | null {
  if (!forecast || forecast.status === "ON_TRACK") return null;
  if (forecast.status === "OVER_COMMITTED") return `Over-committed by ${formatCurrency(forecast.overBy)}`;
  return `Projected to exceed by ${formatCurrency(forecast.overBy)}${forecast.runsOutOn ? ` around ${formatDate(forecast.runsOutOn)}` : ""}`;
}

/** One line for budget cards: the warning, or where an on-track budget is heading. */
export function forecastVerdict(forecast: BudgetForecast): string {
  return (
    forecastWarning(forecast) ??
    (forecast.projectedAmount === null
      ? "On track so far; a projection appears after the first week"
      : `On track: ${formatCurrency(forecast.projectedAmount)} projected by the period end`)
  );
}
