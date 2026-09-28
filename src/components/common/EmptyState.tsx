import { InboxOutlined } from "@mui/icons-material";
import {
  Box,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({
  title = "No records found",
  message = "There is nothing to display yet.",
  action,
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        py: 8,
        px: 3,
      }}
    >
      <Stack
              spacing={1.5}
        sx={{
            alignItems: "center",
            textAlign: "center",
            maxWidth: 420
        }}
      >
        <InboxOutlined
          aria-hidden="true"
          sx={{
            fontSize: 48,
            color: "text.secondary",
          }}
        />

        <Typography variant="h6">
          {title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
        >
          {message}
        </Typography>

        {action}
      </Stack>
    </Box>
  );
}