import { Card, CardContent, Stack, Typography } from "@mui/material";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import { useChartColors } from "../utils/chartColors";

interface KpiTrendCardProps {
  label: string;
  value: string;
  /** Previous-period value for the change indicator; null hides it. */
  current: number | null;
  previous: number | null;
  /** Whether a decrease is the favourable direction (e.g. time to reimburse). */
  lowerIsBetter?: boolean;
  sparkline?: number[];
}

export function KpiTrendCard({ label, value, current, previous, lowerIsBetter, sparkline }: KpiTrendCardProps) {
  const { series } = useChartColors();
  const hasComparison = current !== null && previous !== null && previous > 0;
  const change = hasComparison ? ((current - previous) / previous) * 100 : 0;
  const direction = !hasComparison || Math.abs(change) < 0.5 ? "flat" : change > 0 ? "up" : "down";
  const favourable = direction === "flat" ? null : (direction === "down") === Boolean(lowerIsBetter);
  const Icon = direction === "up" ? TrendingUpIcon : direction === "down" ? TrendingDownIcon : TrendingFlatIcon;

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="kpi" sx={{ fontSize: { xs: "1.5rem", md: "1.6rem" } }}>{value}</Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", minHeight: 20 }}>
            {hasComparison ? (
              <>
                <Icon fontSize="small" color={favourable === null ? "disabled" : favourable ? "success" : "error"} />
                <Typography variant="caption" color="text.secondary">
                  {direction === "flat" ? "No change" : `${Math.abs(change).toFixed(0)}% ${direction === "up" ? "higher" : "lower"}`} than the previous period
                </Typography>
              </>
            ) : (
              <Typography variant="caption" color="text.secondary">No data for the previous period</Typography>
            )}
          </Stack>
          {sparkline && sparkline.length > 1 && (
            <SparkLineChart data={sparkline} height={36} area curve="natural" color={series} />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
