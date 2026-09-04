import {
  Stack,
  Typography,
} from "@mui/material";

interface ChartStateProps {
  title: string;
  message: string;
}

export function ChartState({
  title,
  message,
}: ChartStateProps) {
  return (
    <Stack
      spacing={1}
      sx={{
        minHeight: 220,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <Typography variant="subtitle1">
        {title}
      </Typography>

      <Typography
        variant="body2"
        color="text.secondary"
      >
        {message}
      </Typography>
    </Stack>
  );
}