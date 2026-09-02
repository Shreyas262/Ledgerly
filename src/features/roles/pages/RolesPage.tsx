import { useState } from "react";

import {
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  Divider,
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

import { usePermissions } from "../../../features/auth/hooks/usePermissions";

import type { ID } from "../../../types/common";
import type { Role, RoleName } from "../../../types/auth";

function formatRoleName(roleName: RoleName): string {
  return roleName.charAt(0).toUpperCase() + roleName.slice(1);
}

export function RolesPage() {
  const { can } = usePermissions();

  const {
    data: roles,
    isLoading,
    isError,
  } = useGetRolesQuery();

  const [
    deleteRole,
    { isLoading: isDeleting },
  ] = useDeleteRoleMutation();

  const [deletingRoleId, setDeletingRoleId] =
    useState<ID | null>(null);

  const [editingRole, setEditingRole] =
    useState<Role | null>(null);

  async function handleDelete(roleId: ID) {
    if (!window.confirm("Are you sure to delete this Role?")) {
      return;
    }
    try {
      setDeletingRoleId(roleId);

      await deleteRole(roleId).unwrap();
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
    return <ErrorState />;
  }

  if (!roles?.length) {
    return <EmptyState />;
  }

  return (
    <>
      <Stack spacing={3}>
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
        </Stack>

        {/* {can("roles.create") && (
          <CreateRoleForm />
        )} */}

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