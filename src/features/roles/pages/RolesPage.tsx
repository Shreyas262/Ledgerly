import { useConfirm } from "../../../components/common/ConfirmProvider";
import { BackLink } from "../../../components/navigation/BackLink";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { useState } from "react";

import {
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  Divider,
  DialogTitle,
  DialogContent,
  Stack,
  Typography,
} from "@mui/material";

import {
  useDeleteRoleMutation,
  useGetRolesQuery,
} from "../api/rolesApi";

import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";

import { EditRoleForm } from "../components/EditRoleForm";
import { CreateRoleForm } from "../components/CreateRoleForm";

import { usePermissions } from "../../../features/auth/hooks/usePermissions";

import type { ID } from "../../../types/common";
import type { Role, RoleName } from "../types/role";

function formatRoleName(roleName: RoleName): string {
  return roleName.charAt(0).toUpperCase() + roleName.slice(1);
}

export function RolesPage() {
  const { can } = usePermissions();

  const {
    data: roles,
    isLoading,
    isError,
    error: rolesError,
    refetch,
  } = useGetRolesQuery();

  const [
    deleteRole,
    { isLoading: isDeleting, error: deleteError },
  ] = useDeleteRoleMutation();

  const confirm = useConfirm();
  const [deletingRoleId, setDeletingRoleId] =
    useState<ID | null>(null);

  const [editingRole, setEditingRole] =
    useState<Role | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  async function handleDelete(roleId: ID) {
    if (!(await confirm({ title: "Delete role", message: "Delete this role? This cannot be undone.", confirmLabel: "Delete", destructive: true }))) {
      return;
    }
    try {
      setDeletingRoleId(roleId);

      await deleteRole(roleId).unwrap();
    } catch {
      // The reason (e.g. role still assigned) is exposed through deleteError.
    } finally {
      setDeletingRoleId(null);
    }
  }

  function handleEditSuccess() {
    setEditingRole(null);
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={rolesError} onRetry={refetch} />;
  }

  if (!roles?.length) {
    return <EmptyState />;
  }

  return (
    <>
      <Stack spacing={3}>
        <BackLink to="/admin" label="Administration" />
        {deleteError && <ApiFeedback error={deleteError} />}
        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h4">
            Roles & Permissions
          </Typography>
          {can("roles.create") && (
            <Button variant="contained" onClick={() => setCreateDialogOpen(true)}>
              Create Role
            </Button>
          )}
        </Stack>


        <Stack spacing={2}>
          {roles.map((role) => (
            <Card key={role.id}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack
                    direction={{
                      xs: "column",
                      sm: "row",
                    }}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                    spacing={2}
                  >
                    <Typography variant="h6">
                      {formatRoleName(role.name)}
                    </Typography>

                    <Stack
                      direction="row"
                      spacing={1}
                    >
                      {can("roles.update") && (
                        <Button
                          variant="outlined"
                          onClick={() =>
                            setEditingRole(role)
                          }
                        >
                          Edit
                        </Button>
                      )}

                      {can("roles.delete") && (
                        <Button
                          color="error"
                          variant="outlined"
                          disabled={
                            isDeleting &&
                            deletingRoleId === role.id
                          }
                          onClick={() =>
                            handleDelete(role.id)
                          }
                        >
                          {isDeleting &&
                          deletingRoleId === role.id
                            ? "Deleting..."
                            : "Delete"}
                        </Button>
                      )}
                    </Stack>
                  </Stack>

                  <Divider />

                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      flexWrap: "wrap",
                    }}
                    useFlexGap
                  >
                    {role.permissions.map(
                      (permission) => (
                        <Chip
                          key={permission}
                          label={permission}
                          size="small"
                        />
                      ),
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Stack>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Create Role</DialogTitle>
        <DialogContent dividers>
          <CreateRoleForm onSuccess={() => setCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingRole !== null}
        onClose={() => setEditingRole(null)}
        fullWidth
        maxWidth="sm"
      >
        {editingRole && (
          <EditRoleForm
            role={editingRole}
            onSuccess={handleEditSuccess}
            onCancel={() => setEditingRole(null)}
          />
        )}
      </Dialog>
    </>
  );
}