import { useMemo } from "react";
import {
  Alert,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import { useGetCurrentUserQuery } from "../../auth/api/authApi";
import { useGetAuditLogsQuery } from "../../audit/api/auditApi";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";

export function SecurityPage() {
  const {
    data: userResponse,
    isLoading: isUserLoading,
    isError: isUserError,
  } = useGetCurrentUserQuery();

  const {
    data: auditLogs = [],
    isLoading: isAuditLoading,
    isError: isAuditError,
  } = useGetAuditLogsQuery();

  const user = userResponse?.data;

  const userAuditLogs = useMemo(() => {
    if (!user) {
      return [];
    }

    return auditLogs
      .filter((auditLog) => auditLog.actorId === user.id)
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      );
  }, [auditLogs, user]);

  const lastLogin = userAuditLogs.find(
    (auditLog) => auditLog.resource === "auth" && auditLog.action === "login",
  );

  if (isUserLoading || isAuditLoading) {
    return <LoadingState />;
  }

  if (isUserError) {
    return (
      <ErrorState message="Unable to load account security information." />
    );
  }

  if (!user) {
    return (
      <Alert severity="warning">
        Current user information could not be found.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Security</Typography>

        <Typography color="text.secondary">
          Review your account authentication and recent activity.
        </Typography>
      </div>

      {isAuditError && (
        <Alert severity="warning">
          Recent account activity is currently unavailable.
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Typography variant="h6">Authentication</Typography>

            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Account status
              </Typography>

              <div>
                <Chip label="Authenticated" color="success" size="small" />
              </div>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Account
              </Typography>

              <Typography>{user.name}</Typography>

              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Typography variant="h6">Last Login</Typography>

            {lastLogin ? (
              <Stack spacing={0.5}>
                <Typography>
                  {new Date(lastLogin.createdAt).toLocaleString("en-IN")}
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  {lastLogin.description}
                </Typography>
              </Stack>
            ) : (
              <Typography color="text.secondary">
                No login activity is available.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Typography variant="h6">Recent Account Activity</Typography>

            {userAuditLogs.length === 0 ? (
              <Typography color="text.secondary">
                No recent account activity is available.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {userAuditLogs.slice(0, 5).map((auditLog) => (
                  <Stack key={auditLog.id} spacing={0.5}>
                    <Typography>{auditLog.description}</Typography>

                    <Typography variant="body2" color="text.secondary">
                      {new Date(auditLog.createdAt).toLocaleString("en-IN")}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
