import { Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import type { OrganizationBudgetView } from "../types/budget";

interface BudgetCardProps {
  budget: OrganizationBudgetView;
  onView: (budget: OrganizationBudgetView) => void;
}

export function BudgetCard({ budget, onView }: BudgetCardProps) {
  const utilization = budget.utilization;
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
            <Stack spacing={0.5}>
              <Typography variant="h6">{budget.name}</Typography>
              {budget.description && <Typography variant="body2" color="text.secondary">{budget.description}</Typography>}
            </Stack>
            <Chip label={budget.status.toUpperCase()} size="small" />
          </Stack>
          <Stack spacing={1}>
            <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
              <Typography variant="body2">Utilization</Typography>
              <Typography variant="body2">₹{utilization.spentAmount.toLocaleString("en-IN")} / ₹{budget.amount.toLocaleString("en-IN")}</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={Math.min(utilization.utilizationPercent, 100)} />
            <Typography variant="caption" color="text.secondary">{utilization.utilizationPercent.toFixed(1)}% utilized · ₹{utilization.remainingAmount.toLocaleString("en-IN")} remaining</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">{budget.startDate} → {budget.endDate}</Typography>
          <Typography component="button" onClick={() => onView(budget)} sx={{ border: 0, background: "none", p: 0, textAlign: "left", cursor: "pointer", color: "primary.main", font: "inherit" }}>
            View budget hierarchy
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
