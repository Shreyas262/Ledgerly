import { Alert, AlertTitle, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { getApiError, getApiErrorDetails } from "../../services/api/apiErrors";

interface ApiFeedbackProps {
  error: unknown;
  context?: "load" | "mutation";
  onRetry?: () => void;
  onReconcile?: () => void;
}

export function ApiFeedback({ error, context = "mutation", onRetry, onReconcile }: ApiFeedbackProps) {
  const navigate = useNavigate();
  const apiError = getApiError(error);
  if (!apiError) return null;

  if (apiError.status === 401) {
    return (
      <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => navigate("/auth/login")}>Sign in</Button>}>
        <AlertTitle>Session required</AlertTitle>
        Your session is no longer authenticated. Sign in again to continue.
      </Alert>
    );
  }

  if (apiError.status === 403) {
    return (
      <Alert severity="error">
        <AlertTitle>Access denied</AlertTitle>
        {apiError.message || "You are not authorized to perform this operation."}
      </Alert>
    );
  }

  if (apiError.status === 409) {
    return (
      <Alert
        severity="warning"
        action={
          onReconcile ? (
            <Button color="inherit" size="small" onClick={onReconcile}>Refresh current data</Button>
          ) : undefined
        }
      >
        <AlertTitle>Conflict</AlertTitle>
        {apiError.message || "This resource changed before the operation completed."}
      </Alert>
    );
  }

  if (apiError.status === 422) {
    const details = getApiErrorDetails(error);
    return (
      <Alert severity="warning">
        <AlertTitle>{details.businessRule ? "Business rule" : "Validation failed"}</AlertTitle>
        {details.businessRule ?? apiError.message}
      </Alert>
    );
  }

  return (
    <Alert
      severity="error"
      action={context === "load" && onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Retry</Button> : undefined}
    >
      <AlertTitle>{context === "load" ? "Unable to load" : "Unable to complete operation"}</AlertTitle>
      {apiError.message || "The request could not be completed."}
    </Alert>
  );
}
