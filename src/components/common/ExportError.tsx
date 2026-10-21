import { Alert } from "@mui/material";

import { getApiError } from "../../services/api/apiErrors";
import { ApiFeedback } from "./ApiFeedback";

interface ExportErrorProps {
  /** Why an export failed: a refused request, or a file that could not be created. */
  error: unknown;
  onClose: () => void;
}

/** Explains a failed export; the page and its data are unaffected. */
export function ExportError({ error, onClose }: ExportErrorProps) {
  if (!error) return null;
  if (getApiError(error)) return <ApiFeedback error={error} />;
  return (
    <Alert severity="error" onClose={onClose}>
      The PDF could not be created. Try again.
    </Alert>
  );
}
