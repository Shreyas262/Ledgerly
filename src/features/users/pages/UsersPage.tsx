import {
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";

import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined"
import { useState } from "react";

import { useGetUsersQuery } from "../api/usersApi";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { CreateUserForm } from "../components/CreateUserForm";
import { EditUserDialog } from "../components/EditUserDialog";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { useDeleteUserMutation } from "../api/usersApi";
import type { User } from "../../../types/auth";

export function UsersPage() {
  const { can } = usePermissions();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const {
    data: users,
    isLoading,
    isError,
  } = useGetUsersQuery();
  
  const [
    deleteUser,
    {
      isLoading: isDeleting,
      isError: deleteError,
    },
  ] = useDeleteUserMutation();

  if (!can("users.read")) return <ErrorState />

  if (isLoading) return <LoadingState />

  if (isError) return <ErrorState />
  
  async function handleDelete() {
    if (!deletingUser) return

    try {
      await deleteUser(
        deletingUser.id,
      ).unwrap();

      setDeletingUser(null);
    } catch {
      // Error is exposed through deleteError.
    }
  }

  return (
    <>
      <Stack spacing={3}>
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
          <Typography variant="h4">
            Users
          </Typography>

          {can("users.create") && (
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              onClick={() =>
                setCreateDialogOpen(true)
              }
            >
              Create User
            </Button>
          )}
        </Stack>

        {/* Users */}
        {!users?.length ? (
          <EmptyState />
        ) : (
          <Stack spacing={2}>
            {users.map((user) => (
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
                        <Typography variant="h6">
                          {user.name}
                        </Typography>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          {user.email}
                        </Typography>
                      </Stack>

                      <Chip
                        label={
                          user.role
                            .charAt(0)
                            .toUpperCase() +
                          user.role.slice(1)
                        }
                        variant="outlined"
                      />
                    </Stack>

                    {/* Permissions */}
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{flexWrap: "wrap"}}
                      useFlexGap
                    >
                      {user.permissions.map(
                        (permission) => (
                          <Chip
                            key={permission}
                            label={permission}
                            size="small"
                          />
                        ),
                      )}
                    </Stack>

                    {/* Actions */}
                    {can("users.update") && (
                      <Stack
                        direction="row"
                        sx={{justifyContent: "flex-end"}}
                      >
                        <Button
                          variant="outlined"
                          startIcon={
                            <EditOutlinedIcon />
                          }
                          onClick={() =>
                            setEditingUser(user)
                          }
                        >
                          Edit
                        </Button>
                      </Stack>
                    )}
                    {can("users.delete") && (
                    <Stack
                        direction="row"
                        sx={{justifyContent: "flex-end"}}
                    >
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={
                            <DeleteOutlinedIcon />
                          }
                          onClick={() =>
                            setDeletingUser(user)
                          }
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
      </Stack>

      {/* Create User Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() =>
          setCreateDialogOpen(false)
        }
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Create User
        </DialogTitle>

        <DialogContent dividers>
          <CreateUserForm
            onSuccess={() =>
              setCreateDialogOpen(false)
            }
          />
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <EditUserDialog
        user={editingUser}
        open={Boolean(editingUser)}
        onClose={() =>
          setEditingUser(null)
        }
      />
      
      {/* Delete User */}
      <ConfirmDialog
        open={Boolean(deletingUser)}
        title="Delete User?"
        message={
          deletingUser
            ? `Are you sure you want to delete ${deletingUser.name}? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() =>
          setDeletingUser(null)
        }
      />
      {deleteError && (
        <Typography
          color="error"
          sx={{ mt: 2 }}
        >
          Failed to delete user.
        </Typography>
      )}
    </>
  );
}