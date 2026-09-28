import { LinearProgress, Stack } from "@mui/material";

export function RefreshingState() {
  return (
    <Stack aria-label="Refreshing" role="status" sx={{ width: "100%" }}>
      <LinearProgress />
    </Stack>
  );
}
