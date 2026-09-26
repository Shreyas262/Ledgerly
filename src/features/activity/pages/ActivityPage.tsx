import { useState } from "react";
import { BackLink } from "../../../components/navigation/BackLink";
import {
  Alert,
  Card,
  CardContent,
  Chip,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { LoginOutlined } from "@mui/icons-material";

import { useGetActivityQuery } from "../api/activityApi";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { formatDateTime, humanize } from "../../../utils/format";
import { PageHeader } from "../../../components/common/PageHeader";

const PAGE_SIZE = 10;

export function ActivityPage() {
  const [page, setPage] = useState(1);

  const {
    data: activityResult,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetActivityQuery(
    { page, pageSize: PAGE_SIZE },
    { refetchOnMountOrArgChange: true },
  );

  // Separate query so the last sign-in is correct whichever page is shown.
  const { data: loginResult } = useGetActivityQuery(
    { page: 1, pageSize: 1, filter: { action: "LOGIN" } },
    { refetchOnMountOrArgChange: true },
  );

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  const events = activityResult?.data ?? [];
  const lastLogin = loginResult?.data[0];

  return (
    <Stack spacing={3}>
      <BackLink to="/account" label="Account" />
      <PageHeader
        title="Activity"
        description="Your sign-ins and the actions you have taken in Ledgerly."
      />

      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <LoginOutlined color="action" />
            <Stack spacing={0.25}>
              <Typography variant="body2" color="text.secondary">
                Last sign-in
              </Typography>
              <Typography variant="subtitle1">
                {lastLogin ? formatDateTime(lastLogin.timestamp) : "No sign-in recorded"}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={1.5}>
        <Typography variant="h6">Recent activity</Typography>

        {events.length === 0 ? (
          <Alert severity="info">No account activity is available yet.</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Action</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Area</TableCell>
                  <TableCell>Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id} hover>
                    <TableCell>
                      <Chip label={humanize(event.action)} size="small" />
                    </TableCell>
                    <TableCell>{event.description ?? "—"}</TableCell>
                    <TableCell>{humanize(event.entityType)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {formatDateTime(event.timestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>

      {activityResult && activityResult.total > activityResult.pageSize && (
        <Stack sx={{ alignItems: "center" }}>
          <Pagination
            page={activityResult.page}
            count={Math.ceil(activityResult.total / activityResult.pageSize)}
            onChange={(_event, nextPage) => setPage(nextPage)}
            color="primary"
          />
        </Stack>
      )}
    </Stack>
  );
}
