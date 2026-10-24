import {
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";

interface KpiCardProps {
  label: string;
  value: string | number;
  description?: string;
}

export function KpiCard({
  label,
  value,
  description,
}: KpiCardProps) {
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