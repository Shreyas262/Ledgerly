import { Card, CardActionArea, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { ChipProps } from "@mui/material";

import type { BudgetStatus, OrganizationBudgetView } from "../types/budget";
import { BudgetProgress } from "./BudgetProgress";

interface BudgetCardProps {
  budget: OrganizationBudgetView;
  onView: (budget: OrganizationBudgetView) => void;
}

const statusChip: Record<BudgetStatus, { label: string; color: ChipProps["color"] }> = {
  draft: { label: "Draft", color: "default" },
  active: { label: "Active", color: "success" },
  closed: { label: "Closed", color: "default" },
};

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** The viewer's level of the budget: organization, their departments or team. */
function scopedTotals(budget: OrganizationBudgetView) {
  if (budget.viewScope === "ORGANIZATION") {
    return { label: "Organization", allocated: budget.amount, utilization: budget.utilization };
  }
  const items = budget.viewScope === "DEPARTMENT"
    ? budget.departmentAllocations
    : budget.departmentAllocations.flatMap((department) => department.teamAllocations);
  const allocated = items.reduce((sum, item) => sum + item.amount, 0);
  const spentAmount = items.reduce((sum, item) => sum + item.utilization.spentAmount, 0);
  return {
    label: budget.viewScope === "DEPARTMENT" ? "Your departments" : "Your team",
    allocated,
    utilization: {
      spentAmount,
      remainingAmount: Math.max(allocated - spentAmount, 0),
      utilizationPercent: allocated > 0 ? (spentAmount / allocated) * 100 : 0,
    },
  };
}

export function BudgetCard({ budget, onView }: BudgetCardProps) {
  const totals = scopedTotals(budget);
  const status = statusChip[budget.status];

  return (
    <Card sx={{ height: "100%" }}>
      <CardActionArea onClick={() => onView(budget)} sx={{ height: "100%" }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" noWrap>{budget.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(budget.startDate)} – {formatDate(budget.endDate)}
                </Typography>
              </Stack>
              <Chip label={status.label} color={status.color} size="small" />
            </Stack>

            {budget.description && (
              <Typography variant="body2" color="text.secondary">{budget.description}</Typography>
            )}

            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">{totals.label}</Typography>
              <BudgetProgress allocated={totals.allocated} utilization={totals.utilization} />
            </Stack>

            <Typography variant="body2" color="primary">View breakdown</Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
