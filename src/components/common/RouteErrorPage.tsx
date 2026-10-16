import { Alert, AlertTitle, Button, Stack } from "@mui/material";
import { isRouteErrorResponse, NavLink, useRouteError } from "react-router-dom";

// Messages browsers use when a lazily loaded page can no longer be fetched,
// typically because a new version was deployed while the tab was open.
const CHUNK_LOAD_ERRORS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
];

function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_LOAD_ERRORS.some((message) => error.message.includes(message));
}

/**
 * Route-level error boundary. Shows a recoverable message instead of the
 * router's default error screen and never exposes internal error details.
 */
export function RouteErrorPage() {
  const error = useRouteError();

  if (isChunkLoadError(error)) {
    return (
      <Alert
        severity="info"
        action={
          <Button color="inherit" size="small" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        }
      >
        <AlertTitle>A new version of Ledgerly is available</AlertTitle>
        Reload the page to continue.
      </Alert>
    );
  }

  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <Stack spacing={2}>
      <Alert severity={notFound ? "info" : "error"}>
        <AlertTitle>{notFound ? "Page not found" : "Something went wrong"}</AlertTitle>
        {notFound
          ? "The page you requested does not exist or has been moved."
          : "This page could not be displayed."}
      </Alert>
      <Stack direction="row" spacing={2}>
        {!notFound && (
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        )}
        <Button variant="contained" component={NavLink} to="/dashboard">
          Return to Dashboard
        </Button>
      </Stack>
    </Stack>
  );
}
