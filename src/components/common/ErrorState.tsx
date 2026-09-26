import { ErrorOutlineOutlined, RefreshOutlined } from "@mui/icons-material";
import {
  Alert,
  AlertTitle,
  Button,
} from "@mui/material";

import { getApiError } from "../../services/api/apiErrors";

interface ErrorStateProps {
  title?: string;
  message?: string;
  /** The failed request's error; its status and message are shown to the user. */
  error?: unknown;
  onRetry?: () => void;
}

const titlesByStatus: Record<number, string> = {
  401: "Session expired",
  403: "Access denied",
  404: "Not found",
  409: "Conflict",
  422: "Request not accepted",
};

export function ErrorState({
  title,
  message,
  error,
  onRetry,
}: ErrorStateProps) {
  const apiError = getApiError(error);
  const resolvedTitle =
    title ??
    (apiError ? titlesByStatus[apiError.status] : undefined) ??
    "Something went wrong";
  const resolvedMessage =
    message ??
    apiError?.message ??
    "We couldn't load this information. Please try again.";
  // Retrying cannot fix authorization or missing-resource failures.
  const canRetry =
    Boolean(onRetry) &&
    !(apiError && [401, 403, 404].includes(apiError.status));

  return (
    <Alert
      severity="error"
      icon={<ErrorOutlineOutlined />}
      action={
        canRetry ? (
          <Button
            color="inherit"
            size="small"
            startIcon={<RefreshOutlined />}
            onClick={onRetry}
          >
            Retry
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{resolvedTitle}</AlertTitle>

      {resolvedMessage}
    </Alert>
  );
}
