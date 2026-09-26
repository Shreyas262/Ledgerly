import { ArrowBackOutlined } from "@mui/icons-material";
import { Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

interface BackLinkProps {
  to: string;
  label: string;
}

/** "Back to …" link shown at the top of pages that belong to a section hub. */
export function BackLink({ to, label }: BackLinkProps) {
  return (
    <Button
      component={RouterLink}
      to={to}
      startIcon={<ArrowBackOutlined />}
      sx={{ alignSelf: "flex-start" }}
    >
      Back to {label}
    </Button>
  );
}
