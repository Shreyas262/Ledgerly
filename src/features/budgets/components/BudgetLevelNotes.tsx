import { Stack, Typography } from "@mui/material";
import { ErrorOutlineOutlined, WarningAmberOutlined } from "@mui/icons-material";

import { formatCurrency } from "../../../utils/currency";
import type { BudgetForecast, BudgetUtilization } from "../types/budget";
import { forecastWarning } from "../utils/forecastText";

interface BudgetLevelNotesProps {
  utilization: BudgetUtilization;
  forecast: BudgetForecast | null;
}

/**
 * Under a level's progress bar (§28.8, §28.19): its committed spend, kept
 * apart from spend, and a warning when its forecast is not on track.
 */
export function BudgetLevelNotes({ utilization, forecast }: BudgetLevelNotesProps) {
  const committed = utilization.committedAmount ?? 0;
  const warning = forecastWarning(forecast);
  if (!committed && !warning) return null;

  return (
    <Stack spacing={0.25}>
      {committed > 0 && (
        <Typography variant="body2" color="text.secondary">
          {formatCurrency(committed)} committed: approved, awaiting reimbursement
        </Typography>
      )}
      {warning && (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          {forecast?.status === "OVER_COMMITTED" ? (
            <ErrorOutlineOutlined fontSize="small" color="error" aria-hidden="true" />
          ) : (
            <WarningAmberOutlined fontSize="small" color="warning" aria-hidden="true" />
          )}
          <Typography variant="body2" color="text.secondary">{warning}</Typography>
        </Stack>
      )}
    </Stack>
  );
}
