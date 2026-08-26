import { Grid, Stack, Typography } from "@mui/material";

import { KpiCard } from "../components/KpiCard";
import { DashboardSection } from "../components/DashboardSection";
import { SpendingOverview } from "../components/SpendingOverview";
import { SpendingBreakdown } from "../components/SpendingBreakdown";
import { RecentExpenses } from "../components/RecentExpenses";
import { dashboardKpis } from "../data/DashboardKpis.mock";

export function DashboardPage() {
  return (
    <Stack spacing={4}>
      <Stack spacing={0.5}>
        <Typography
          variant="h4"
          component="h1"
          sx={{fontWeight: 700}}
        >
          Dashboard
        </Typography>

        <Typography variant="body1" color="text.secondary">
          Overview of your organization&apos;s financial activity.
        </Typography>
      </Stack>

      <Grid container spacing={2}>
        {dashboardKpis.map((kpi) => (
          <Grid
            key={kpi.label}
            size={{
              xs: 12,
              sm: 6,
              lg: 4,
            }}
          >
            <KpiCard {...kpi} />
          </Grid>
        ))}
      </Grid>

      <DashboardSection
        title="Spending Overview"
        description="Track spending trends over time."
      >
        <SpendingOverview />
      </DashboardSection>

      <DashboardSection
        title="Spending Breakdown"
        description="Understand where organizational spending is concentrated."
      >
        <SpendingBreakdown />
      </DashboardSection>

      <DashboardSection
        title="Recent Expenses"
        description="Latest expense activity across the organization."
      >
        <RecentExpenses />
      </DashboardSection>
    </Stack>
  );
}