import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";

interface KpiCardProps {
  label: string;
  value: string | number;
  description?: string;
  /** A small trend line under the figure, oldest value first. */
  sparkline?: number[];
  /** Says what the trend line shows, for assistive technology. */
  sparklineLabel?: string;
}

export function KpiCard({
  label,
  value,
  description,
  sparkline,
  sparklineLabel,
}: KpiCardProps) {
  const { palette } = useTheme();

  return (
    // Fills its grid cell so a row of cards ends level when one description wraps.
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography
            variant="body2"
            color="text.secondary"
          >
            {label}
          </Typography>

          <Typography variant="kpi">
            {value}
          </Typography>

          {sparkline && sparkline.length > 1 && (
            <Box role="img" aria-label={sparklineLabel} sx={{ height: 32 }}>
              <SparkLineChart data={sparkline} height={32} color={palette.chart.series} curve="natural" area />
            </Box>
          )}

          {description && (
            <Typography
              variant="body2"
              color="text.secondary"
            >
              {description}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
