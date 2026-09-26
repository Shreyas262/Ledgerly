import { Chip, LinearProgress, Stack, Typography } from "@mui/material";

import type { BudgetUtilization } from "../types/budget";

export const formatMoney = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/** Utilization bands: amber from 80%, red above 100%. */
export function utilizationColor(percent: number): "primary" | "warning" | "error" {
  if (percent > 100) return "error";
  if (percent >= 80) return "warning";
  return "primary";
}

interface BudgetProgressProps {
  allocated: number;
  utilization: BudgetUtilization;
  dense?: boolean;
}

/** Allocated / spent / remaining with a colour-coded bar. */
export function BudgetProgress({ allocated, utilization, dense = false }: BudgetProgressProps) {
  const percent = utilization.utilizationPercent;
  const color = utilizationColor(percent);
  const overBy = utilization.spentAmount - allocated;

  return (
    <Stack spacing={dense ? 0.5 : 1}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant={dense ? "body2" : "body1"}>
          {formatMoney(utilization.spentAmount)} spent of {formatMoney(allocated)}
        </Typography>
        {percent > 100 ? (
          <Chip size="small" color="error" label={`Over budget by ${formatMoney(overBy)}`} />
        ) : (
          <Typography variant="body2" color={color === "warning" ? "warning.main" : "text.secondary"}>
            {formatMoney(utilization.remainingAmount)} left · {percent.toFixed(1)}%
          </Typography>
        )}
      </Stack>
      <LinearProgress
        variant="determinate"
        color={color}
        value={Math.min(percent, 100)}
        sx={{ height: dense ? 6 : 8, borderRadius: 1 }}
        aria-label={`${percent.toFixed(1)}% of budget used`}
      />
    </Stack>
  );
}
