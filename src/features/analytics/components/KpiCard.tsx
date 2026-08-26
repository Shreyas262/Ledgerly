import {
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";

import type { KpiData } from "../types/dashboard";

interface KpiCardProps extends KpiData {}

export function KpiCard({
  label,
  value,
  icon,
  description,
}: KpiCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{
                alignItems: "center",
                justifyContent: "space-between",
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{fontWeight: 500}}
            >
              {label}
            </Typography>

            {icon}
          </Stack>

          <Typography
            variant="h4"
            component="p"
            sx={{fontWeight: 700}}
          >
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