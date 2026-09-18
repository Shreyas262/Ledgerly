import { Box, Container, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={3}>
          <Stack spacing={0.5} sx={{ alignItems: "center" }}>
            <Typography variant="h4" component="div" sx={{ fontWeight: 700 }}>
              Ledgerly
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center" }}
            >
              Expense management for modern organizations
            </Typography>
          </Stack>

          <Paper
            elevation={2}
            sx={{
              p: { xs: 3, sm: 4 },
            }}
          >
            {children}
          </Paper>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center" }}
          >
            Manage expenses. Control spending. Stay accountable.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
