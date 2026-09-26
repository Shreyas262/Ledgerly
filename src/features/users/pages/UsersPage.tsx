import { useConfirm } from "../../../components/common/ConfirmProvider";
import { BackLink } from "../../../components/navigation/BackLink";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  Pagination,
} from "@mui/material";

import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { useState } from "react";

import { useGetUsersQuery } from "../api/usersApi";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { CreateUserForm } from "../components/CreateUserForm";
import { EditUserDialog } from "../components/EditUserDialog";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import {
  useDeleteUserMutation,
  useUpdateUserStatusMutation,
} from "../api/usersApi";
import type { User } from "../types/user";

export function UsersPage() {
  const { can } = usePermissions();
  const [page, setPage] = useState(1);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const {
    data: users,
    isLoading,
    isError,
    error: usersError,
    refetch,
  } = useGetUsersQuery({ page, pageSize: 25 });

  const [updateUserStatus] = useUpdateUserStatusMutation();
  const confirm = useConfirm();

  const [deleteUser, { isLoading: isDeleting, error: deleteError }] =
    useDeleteUserMutation();

  if (!can("users.read"))
    return (
      <ErrorState
        title="Access denied"
        message="You do not have permission to view users."
      />
    );

  if (isLoading) return <LoadingState />;

  if (isError) return <ErrorState error={usersError} onRetry={refetch} />;

  async function handleDelete() {
    if (!deletingUser) return;

    try {
      await deleteUser(deletingUser.id).unwrap();

      setDeletingUser(null);
    } catch {
      // Close the dialog so the reason (exposed through deleteError) is visible.
      setDeletingUser(null);
    }
  }

  return (
    <>
      <Stack spacing={3}>
        <BackLink to="/admin" label="Administration" />
        {/* Page header */}
        <Stack
          sx={{
            display: "flex",
            flexDirection: {
              xs: "column",
              sm: "row",
            },
            justifyContent: "space-between",
            alignItems: {
              xs: "flex-start",
              sm: "center",
            },
            gap: 2, // Equivalent to spacing={2} (16px)
          }}
        >
          <Typography variant="h4">Users</Typography>

          {can("users.create") && (
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create User
            </Button>
          )}
        </Stack>

        {/* Users */}
        {!users?.data.length ? (
          <EmptyState />
        ) : (
          <Stack spacing={2}>
            {users.data.map((user) => (
              <Card key={user.id}>
                <CardContent>
                  <Stack spacing={2}>
                    {/* User information */}
                    <Stack
                      sx={{
                        display: "flex",
                        flexDirection: {
                          xs: "column",
                          sm: "row",
                        },
                        justifyContent: "space-between",
                        alignItems: {
                          xs: "flex-start",
                          sm: "center",
                        },
                        gap: 2, // Equivalent to spacing={2} (16px)
                      }}
                    >
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle1">{user.name}</Typography>

                        <Typography variant="body2" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={1}>
                        <Chip
                          label={
                            user.status === "inactive" ? "Inactive" : "Active"
                          }
                          color={
                            user.status === "inactive" ? "default" : "success"
                          }
                          size="small"
                        />
                        <Chip
                          label={
                            user.role.charAt(0).toUpperCase() +
                            user.role.slice(1)
                          }
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>

                    {/* Permissions */}
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ flexWrap: "wrap" }}
                      useFlexGap
                    >
                      {user.permissions.map((permission) => (
                        <Chip
                          key={permission}
                          label={permission}
                          size="small"
                        />
                      ))}
                    </Stack>

                    {/* Actions */}
                    {can("users.update") && (
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "flex-end" }}
                      >
                        <Button
                          variant="outlined"
                          startIcon={<EditOutlinedIcon />}
                          onClick={() => setEditingUser(user)}
                        >
                          Edit
                        </Button>
                      </Stack>
                    )}
                    {can("users.update") && (
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "flex-end" }}
                      >
                        <Button
                          variant="outlined"
                          onClick={() =>
                            confirm({
                              title: user.status === "inactive" ? "Activate user" : "Deactivate user",
                              message: user.status === "inactive"
                                ? `Allow ${user.name} to sign in again?`
                                : `${user.name} will no longer be able to sign in. Continue?`,
                              confirmLabel: user.status === "inactive" ? "Activate" : "Deactivate",
                              destructive: user.status !== "inactive",
                            }).then((ok) => { if (ok) void updateUserStatus({
                              id: user.id,
                              status:
                                user.status === "inactive"
                                  ? "active"
                                  : "inactive",
                            }); })
                          }
                        >
                          {user.status === "inactive"
                            ? "Activate"
                            : "Deactivate"}
                        </Button>
                      </Stack>
                    )}
                    {can("users.delete") && (
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "flex-end" }}
                      >
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteOutlinedIcon />}
                          onClick={() => setDeletingUser(user)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        {users && users.total > users.pageSize && (
          <Stack sx={{ alignItems: "center" }}>
            <Pagination
              page={users.page}
              count={Math.ceil(users.total / users.pageSize)}
              onChange={(_event, nextPage) => setPage(nextPage)}
              color="primary"
            />
          </Stack>
        )}
      </Stack>

      {/* Create User Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Create User</DialogTitle>

        <DialogContent dividers>
          <CreateUserForm onSuccess={() => setCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <EditUserDialog
        user={editingUser}
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
      />

      {/* Delete User */}
      <ConfirmDialog
        open={Boolean(deletingUser)}
        title="Delete User?"
        message={
          deletingUser
            ? `Delete ${deletingUser.name}? They lose access and are removed from their team and department. Their expense history is kept; drafts are cancelled and submitted expenses continue through approval and reimbursement.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingUser(null)}
      />
      {deleteError && (
        <Box sx={{ mt: 2 }}>
          <ApiFeedback error={deleteError} />
        </Box>
      )}
    </>
  );
}
