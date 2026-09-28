import { Box, Grid, Stack, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import type { AnalyticsPolicyCompliance } from "../types/analytics";
import { ChartCard } from "../../../components/common/ChartCard";
import { useChartColors } from "../utils/chartColors";
import { RULE_LABELS } from "../../policies/utils/policyText";

interface PolicyComplianceCardProps {
  compliance: AnalyticsPolicyCompliance;
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h5">{value}</Typography>
      {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
    </Stack>
  );
}

/** Policy outcomes: escalations, warnings and blocked submissions by rule (§26.8). */
export function PolicyComplianceCard({ compliance }: PolicyComplianceCardProps) {
  const colors = useChartColors();
  const share = compliance.checked ? Math.round((compliance.escalated / compliance.checked) * 100) : 0;
  const rows = compliance.byRule;
  const isEmpty = compliance.checked === 0 && compliance.blockedAttempts === 0;

  return (
    <ChartCard
      title="Policy compliance"
      subtitle="Policy check outcomes for expenses dated in the selected period"
      isEmpty={isEmpty}
      emptyMessage="No policy checks in the selected period."
      minHeight={160}
    >
      <Stack spacing={3}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 3 }}>
            <Stat label="Checked against a policy" value={compliance.checked} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Stat label="Above approval threshold" value={compliance.escalated} detail={`${share}% of checked`} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Stat label="Submitted with warnings" value={compliance.withWarnings} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Stat label="Blocked submission attempts" value={compliance.blockedAttempts} />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: compliance.blockedByDepartment.length ? 7 : 12 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>By rule</Typography>
            {rows.length ? (
              <BarChart
                height={rows.length * 48 + 72}
                layout="horizontal"
                yAxis={[{ scaleType: "band", data: rows.map((row) => RULE_LABELS[row.rule]), width: 150 }]}
                xAxis={[{ tickMinStep: 1 }]}
                series={[
                  { label: "Warnings", data: rows.map((row) => row.warnings), color: colors.warning, stack: "rule" },
                  { label: "Blocked", data: rows.map((row) => row.blocked), color: colors.error, stack: "rule" },
                ]}
                grid={{ vertical: true }}
                borderRadius={4}
                margin={{ top: 8, right: 24 }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">No warnings or blocked attempts.</Typography>
            )}
          </Grid>
          {compliance.blockedByDepartment.length > 0 && (
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Blocked attempts by department</Typography>
              <Stack spacing={1}>
                {compliance.blockedByDepartment.map((row) => (
                  <Stack key={row.dimensionId} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Typography variant="body2" sx={{ width: 120, flexShrink: 0 }} noWrap>{row.dimensionName}</Typography>
                    <Box sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: "action.hover", overflow: "hidden" }}>
                      <Box sx={{ height: "100%", width: `${(row.count / compliance.blockedAttempts) * 100}%`, bgcolor: colors.error }} />
                    </Box>
                    <Typography variant="body2" sx={{ width: 28, textAlign: "right" }}>{row.count}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          )}
        </Grid>
      </Stack>
    </ChartCard>
  );
}
