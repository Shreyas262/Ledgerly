import type { ReactNode } from "react";
import { Box, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";

import { CheckCircleOutlineOutlined, WarningAmberOutlined } from "@mui/icons-material";

import { BudgetProgress, utilizationColor } from "../../budgets/components/BudgetProgress";
import { Amount } from "../../../components/common/Amount";
import { formatCurrency } from "../../../utils/currency";
import { PERSONAL_EXPENSE_TYPE_LABELS, type PersonalBudgetWithUsage, type PersonalSpendingPace } from "../types/personal";
import { currentMonth, formatMonth } from "../utils/personalFormat";

interface PersonalBudgetCardProps {
  budget: PersonalBudgetWithUsage;
  /** This month's pace, shown under the progress bar. */
  pace?: PersonalSpendingPace | null;
  actions?: ReactNode;
}

const dayCount = (days: number) => (days === 1 ? "today" : `the remaining ${days} days`);

/** Daily allowance and where spending is heading, in words; the icon repeats the verdict. */
function BudgetPace({ budget, pace }: { budget: PersonalBudgetWithUsage; pace: PersonalSpendingPace }) {
  const heading = pace.projectedSpend > budget.amount;
  return (
    <Stack spacing={0.75} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "background.subtle" }}>
      <Typography variant="body2">
        {budget.remaining > 0 ? (
          <>
            <Typography component="span" variant="subtitle2"><Amount value={pace.dailyAllowance} /></Typography> a day left for {dayCount(pace.daysLeft)}
          </>
        ) : (
          "Nothing is left to spend this month."
        )}
      </Typography>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
        {heading ? (
          <WarningAmberOutlined fontSize="small" color="warning" aria-hidden="true" />
        ) : (
          <CheckCircleOutlineOutlined fontSize="small" color="success" aria-hidden="true" />
        )}
        <Typography variant="body2" color="text.secondary">
          At this pace you will spend {formatCurrency(pace.projectedSpend)} this month,{" "}
          {heading
            ? `${formatCurrency(pace.projectedSpend - budget.amount)} over budget.`
            : "within budget."}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        An even pace would have spent {formatCurrency(pace.expectedByToday)} by today.
      </Typography>
    </Stack>
  );
}

/** A monthly budget with overall and per-type utilization. */
export function PersonalBudgetCard({ budget, pace, actions }: PersonalBudgetCardProps) {
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

        {pace && <BudgetPace budget={budget} pace={pace} />}

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
