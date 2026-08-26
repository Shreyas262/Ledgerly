import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";

interface DashboardSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function DashboardSection({
  title,
  description,
  children,
}: DashboardSectionProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Stack spacing={0.5}>
            <Typography variant="h6" component="h2" sx={{fontWeight: 600}}>
              {title}
            </Typography>

            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Stack>

          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}