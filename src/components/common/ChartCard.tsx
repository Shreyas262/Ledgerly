import type { ReactNode } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Shown instead of the chart when there is nothing to plot. */
  emptyMessage?: string;
  isEmpty?: boolean;
  minHeight?: number;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, action, emptyMessage, isEmpty, minHeight = 280, children }: ChartCardProps) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
        <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
          </Box>
          {action}
        </Stack>
        {isEmpty ? (
          <Stack spacing={1} sx={{ flex: 1, minHeight, alignItems: "center", justifyContent: "center", color: "text.secondary", textAlign: "center" }}>
            <InsightsOutlinedIcon fontSize="large" />
            <Typography variant="body2">{emptyMessage ?? "No data for the selected filters."}</Typography>
          </Stack>
        ) : (
          <Box sx={{ flex: 1, minHeight, minWidth: 0 }}>{children}</Box>
        )}
      </CardContent>
    </Card>
  );
}
