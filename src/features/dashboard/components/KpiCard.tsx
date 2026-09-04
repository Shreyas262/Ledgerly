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
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Typography
            variant="body2"
            color="text.secondary"
          >
            {label}
          </Typography>

          <Typography variant="h4">
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