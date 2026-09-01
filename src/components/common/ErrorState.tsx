import { ErrorOutlineOutlined, RefreshOutlined } from "@mui/icons-material";
import {
  Alert,
  AlertTitle,
  Button,
} from "@mui/material";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this information. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <Alert
      severity="error"
      icon={<ErrorOutlineOutlined />}
      action={
        onRetry ? (
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
      <AlertTitle>{title}</AlertTitle>

      {message}
    </Alert>
  );
}