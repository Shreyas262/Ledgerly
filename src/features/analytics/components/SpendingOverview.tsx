import { Box, Stack, Typography } from "@mui/material";

export function SpendingOverview() {
  return (
    <Box
      sx={{
        minHeight: 320,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.default",
      }}
    >
      <Stack spacing={0.5} sx={{alignItems: "center"}}>
        <Typography variant="body1" sx={{fontWeight: 600}}>
          Spending Overview
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Analytics visualization will be connected later.
        </Typography>

        <Typography variant="caption" color="text.secondary">
          Mock presentation area
        </Typography>
      </Stack>
    </Box>
  );
}