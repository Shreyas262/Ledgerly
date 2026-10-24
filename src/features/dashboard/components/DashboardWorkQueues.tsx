import type { ReactNode } from "react";
import { Button, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import { ArrowForwardOutlined } from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";

import type { DashboardWorkQueues as WorkQueuesData } from "../types/dashboard";
import { formatCurrency } from "../../../utils/currency";

interface QueueItemProps {
  label: string;
  value: number;
  description: ReactNode;
  action: { label: string; to: string };
}

function QueueItem({ label, value, description, action }: QueueItemProps) {
  return (
    <Stack spacing={1} sx={{ flex: 1, minWidth: 0, alignItems: "flex-start" }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="kpi">{value}</Typography>
      <Typography variant="body2" color="text.secondary" component="div" sx={{ flex: 1 }}>{description}</Typography>
      <Button component={RouterLink} to={action.to} variant="outlined" size="small" endIcon={<ArrowForwardOutlined />}>
        {action.label}
      </Button>
    </Stack>
  );
}

const days = (count: number) => (count === 1 ? "1 day" : `${count} days`);

/**
 * Work waiting on the user in their role, side by side in one card so one,
 * two or three queues always fill the row. Nothing is shown for roles without such work.
 */
export function DashboardWorkQueues({ queues }: { queues: WorkQueuesData }) {
  const { approvals, reimbursements, budgetAlerts } = queues;
  const items: QueueItemProps[] = [];

  if (approvals) {
    items.push({
      label: "Approvals waiting for you",
      value: approvals.count,
      description:
        approvals.count === 0
          ? "Nothing is waiting for your review."
          : approvals.oldestWaitingDays === null
            ? "Submitted for your review"
            : `The oldest has waited ${days(approvals.oldestWaitingDays)}.`,
      action: { label: "Open Approvals", to: "/approvals" },
    });
  }
  if (reimbursements) {
    items.push({
      label: "Ready to reimburse",
      value: reimbursements.count,
      description:
        reimbursements.count === 0
          ? "No approved expenses are waiting for payment."
          : `${formatCurrency(reimbursements.amount)} to pay out`,
      action: { label: "Open Reimbursements", to: "/reimbursements" },
    });
  }
  if (budgetAlerts) {
    items.push({
      label: "Budgets near their limit",
      value: budgetAlerts.length,
      description:
        budgetAlerts.length === 0 ? (
          "Every active budget is below 80% used."
        ) : (
          <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2 }}>
            {budgetAlerts.slice(0, 3).map((alert) => (
              <li key={`${alert.budgetId}-${alert.name}`}>
                {alert.name}: <Typography variant="numeric">{alert.utilizationPercent.toFixed(0)}%</Typography> used
              </li>
            ))}
            {budgetAlerts.length > 3 && <li>and {budgetAlerts.length - 3} more</li>}
          </Stack>
        ),
      action: { label: "Open Budgets", to: "/budgets" },
    });
  }

  if (items.length === 0) return null;

  return (
    <Card component="section" aria-labelledby="work-queues-title">
      <CardContent>
        <Typography id="work-queues-title" variant="h6" component="h2" sx={{ mb: 2 }}>Your work</Typography>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 2, md: 3 }}
          // Horizontal between stacked items, vertical between columns.
          divider={<Divider flexItem sx={{ borderBottomWidth: { md: 0 }, borderRightWidth: { md: "thin" } }} />}
        >
          {items.map((item) => (
            <QueueItem key={item.label} {...item} />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
