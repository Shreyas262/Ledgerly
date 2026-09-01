import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type {
  RoleName,
  User,
} from "../../../types/auth";

import {
  useGetRolesQuery,
} from "../../../features/roles/api/rolesApi";

import {
  useUpdateUserMutation,
} from "../../../features/users/api/usersApi";

import {
  permissionGroups,
} from "../../../mocks/data/permissions";

interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
}

export function EditUserDialog({
  user,
  open,
  onClose,
}: EditUserDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] =
    useState<RoleName>("employee");

  const {
    data: roles,
    isLoading: rolesLoading,
    isError: rolesError,
  } = useGetRolesQuery();

  const [
    updateUser,
    {
      isLoading: isUpdating,
      isError: updateError,
    },
  ] = useUpdateUserMutation();

  /*
   * Populate the form whenever a different user
   * is selected.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    setName(user.name);
    setEmail(user.email);
    setPassword("");
    setRole(user.role);
  }, [user]);

  /*
   * Find the role returned by the API.
   */
  const selectedRole = roles?.find(
    (item) => item.name === role,
  );

  /*
   * Permissions are derived from the role.
   */
  const selectedPermissions =
    selectedRole?.permissions ?? [];

  async function handleSubmit(
    event: SyntheticEvent,
  ) {
    event.preventDefault();

    if (!user || !selectedRole) {
      return;
    }

    try {
      await updateUser({
        id: user.id,
        body: {
          name,
          email,
          role,
          permissions: selectedPermissions,
          ...(password
            ? { password }
            : {}),
        },
      }).unwrap();

      onClose();
    } catch {
      // Error is exposed through updateError.
    }
  }

  return (
    <Dialog
      open={open}
      onClose={isUpdating ? undefined : onClose}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>
        Edit User
      </DialogTitle>

      <Box
        component="form"
        onSubmit={handleSubmit}
      >
        <DialogContent dividers>
          <Stack spacing={3}>
            {/* Basic information */}
            <Stack spacing={2}>
              <TextField
                label="Name"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                required
                fullWidth
              />

              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
                fullWidth
              />

              <TextField
                label="New Password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                helperText="Leave blank to keep the current password."
                fullWidth
              />
            </Stack>

            {/* Role */}
            <FormControl fullWidth>
              <InputLabel id="edit-user-role-label">
                Role
              </InputLabel>

              <Select
                labelId="edit-user-role-label"
                value={roles ? role : ""}
                label="Role"
                disabled={
                  rolesLoading ||
                  rolesError ||
                  isUpdating
                }
                onChange={(event) =>
                  setRole(
                    event.target.value as RoleName,
                  )
                }
              >
                {roles?.map((item) => (
                  <MenuItem
                    key={item.id}
                    value={item.name}
                  >
                    {item.name
                      .charAt(0)
                      .toUpperCase() +
                      item.name.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Permissions */}
            <Stack spacing={2}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle1">
                  Permissions
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Permissions are inherited from
                  the selected role.
                </Typography>
              </Stack>

              {Object.entries(
                permissionGroups,
              ).map(
                ([
                  groupName,
                  groupPermissions,
                ]) => {
                  const availablePermissions =
                    groupPermissions.filter(
                      (permission) =>
                        selectedPermissions.includes(
                          permission,
                        ),
                    );

                  if (
                    !availablePermissions.length
                  ) {
                    return null;
                  }

                  return (
                    <Card
                      key={groupName}
                      variant="outlined"
                    >
                      <CardContent>
                        <Stack spacing={1.5}>
                          <Typography
                            variant="subtitle2"
                            sx={{fontWeight: 600}}
                          >
                            {groupName}
                          </Typography>

                          <Box
                            sx={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 1,
                            }}
                          >
                            {availablePermissions.map(
                              (permission) => (
                                <Chip
                                  key={permission}
                                  label={
                                    permission.split(
                                      ".",
                                    )[1]
                                  }
                                  size="small"
                                />
                              ),
                            )}
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                },
              )}
            </Stack>

            {rolesError && (
              <Typography color="error">
                Failed to load roles.
              </Typography>
            )}

            {updateError && (
              <Typography color="error">
                Failed to update user.
              </Typography>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={
              isUpdating ||
              rolesLoading ||
              rolesError ||
              !selectedRole ||
              !name.trim() ||
              !email.trim()
            }
          >
            {isUpdating
              ? "Saving..."
              : "Save Changes"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}