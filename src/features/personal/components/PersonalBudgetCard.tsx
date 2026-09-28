import type { ReactNode } from "react";
import { Box, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";

import { BudgetProgress, utilizationColor } from "../../budgets/components/BudgetProgress";
import { formatCurrency } from "../../../utils/currency";
import { PERSONAL_EXPENSE_TYPE_LABELS, type PersonalBudgetWithUsage } from "../types/personal";
import { currentMonth, formatMonth } from "../utils/personalFormat";

interface PersonalBudgetCardProps {
  budget: PersonalBudgetWithUsage;
  actions?: ReactNode;
}

/** A monthly budget with overall and per-type utilization. */
export function PersonalBudgetCard({ budget, actions }: PersonalBudgetCardProps) {
  const isCurrent = budget.month === currentMonth();

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="h6">{formatMonth(budget.month)}</Typography>
            {isCurrent && <Chip size="small" color="primary" label="This month" />}
          </Stack>
          {actions && <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>{actions}</Stack>}
        </Stack>

        <BudgetProgress
          allocated={budget.amount}
          utilization={{
            spentAmount: budget.spent,
            remainingAmount: budget.remaining,
            utilizationPercent: budget.utilizationPercent,
          }}
        />

        {budget.typeUsage.length > 0 && (
          <Stack spacing={1.25}>
            <Typography variant="subtitle2" color="text.secondary">Limits by type</Typography>
            {budget.typeUsage.map((usage) => {
              const percent = usage.amount > 0 ? (usage.spent / usage.amount) * 100 : 0;
              return (
                <Box key={usage.type}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
                    <Typography variant="body2">{PERSONAL_EXPENSE_TYPE_LABELS[usage.type]}</Typography>
                    <Typography variant="body2" color={percent > 100 ? "error.main" : "text.secondary"}>
                      {formatCurrency(usage.spent)} / {formatCurrency(usage.amount)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    color={utilizationColor(percent)}
                    value={Math.min(percent, 100)}
                    sx={{ height: 6, mt: 0.5 }}
                    aria-label={`${PERSONAL_EXPENSE_TYPE_LABELS[usage.type]}: ${percent.toFixed(0)}% used`}
                  />
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
