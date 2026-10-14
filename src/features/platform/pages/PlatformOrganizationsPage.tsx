import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AddOutlined } from "@mui/icons-material";

import { PageHeader } from "../../../components/common/PageHeader";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { formatDate, humanize } from "../../../utils/format";
import { useGetPlatformOrganizationsQuery } from "../api/platformApi";
import { CreateOrganizationDialog } from "../components/CreateOrganizationDialog";

/** Platform operators create organizations and their first Admin here. */
export function PlatformOrganizationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { data: organizations = [], isLoading, isError, error, refetch } = useGetPlatformOrganizationsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const createButton = (
    <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setDialogOpen(true)}>
      Create Organization
    </Button>
  );

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Organizations"
        description="Every organization on Ledgerly. Create an organization together with its first Admin."
        actions={createButton}
      />

      {isLoading ? (
        <LoadingState message="Loading organizations…" />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : organizations.length === 0 ? (
        <Paper>
          <EmptyState title="No organizations yet" message="Create the first organization to get started." action={createButton} />
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Organization</TableCell>
                <TableCell>Admins</TableCell>
                <TableCell align="right">Users</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {organizations.map((organization) => (
                <TableRow key={organization.id}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>{organization.name}</Typography>
                  </TableCell>
                  <TableCell>
                    {organization.admins.length ? (
                      <Stack spacing={0.25}>
                        {organization.admins.map((admin) => (
                          <Typography key={admin.id} variant="body2">
                            {admin.name}{" "}
                            <Typography component="span" variant="body2" color="text.secondary">({admin.email})</Typography>
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">No Admin</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{organization.userCount}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={humanize(organization.status)}
                      color={organization.status === "active" ? "success" : "default"}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{formatDate(organization.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CreateOrganizationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(message) => {
          setDialogOpen(false);
          setNotice(message);
        }}
      />

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setNotice(null)}>{notice}</Alert>
      </Snackbar>
    </Stack>
  );
}
