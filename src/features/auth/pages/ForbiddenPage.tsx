import {
  Button,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <Stack
      component="main"
      spacing={2}
      sx={{
        minHeight: "60vh",
        textAlign: "center",
        px: 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography variant="h3" component="h1">
        403
      </Typography>

      <Typography variant="h5">
        Access denied
      </Typography>

      <Typography color="text.secondary">
        You do not have permission to access this page.
      </Typography>

      <Button
        variant="contained"
        onClick={() => navigate("/dashboard")}
      >
        Back to dashboard
      </Button>
    </Stack>
  );
}