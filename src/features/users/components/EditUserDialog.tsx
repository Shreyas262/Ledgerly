import { useConfirm } from "../../../components/common/ConfirmProvider";
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
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { User } from "../types/user";

import { useGetRolesQuery } from "../../../features/roles/api/rolesApi";

import { useUpdateUserMutation } from "../../../features/users/api/usersApi";

import { permissionGroups } from "../../roles/constants/permissions";
import {
  useGetDepartmentsQuery,
  useGetTeamsQuery,
} from "../../organizations/api/organizationApi";
import type { RoleName } from "../../roles/types/role";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { useAuth } from "../../auth/context/AuthContext";

interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
}

export function EditUserDialog({ user, open, onClose }: EditUserDialogProps) {
  const { user: currentUser } = useAuth();
  // Admins cannot change their own role.
  const isSelf = Boolean(user && user.id === currentUser?.id);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleName>("employee");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [financeDepartmentIds, setFinanceDepartmentIds] = useState<string[]>([]);

  const { data: departments } = useGetDepartmentsQuery();
  const { data: teams } = useGetTeamsQuery();

  const {
    data: roles,
    isLoading: rolesLoading,
    isError: rolesError,
  } = useGetRolesQuery();

  const confirm = useConfirm();
  const [updateUser, { isLoading: isUpdating, error: updateError }] =
    useUpdateUserMutation();

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
    setDepartmentId(user.departmentId);
    setTeamId(user.teamId);
    setFinanceDepartmentIds(user.financeDepartmentIds ?? []);
  }, [user]);

  /*
   * Find the role returned by the API.
   */
  const selectedRole = roles?.find((item) => item.name === role);

  /*
   * Permissions are derived from the role.
   */
  const selectedPermissions = selectedRole?.permissions ?? [];

  async function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();

    if (!user || !selectedRole) {
      return;
    }
    if (!(await confirm({ title: "Save User", message: `Save changes to ${name}?`, confirmLabel: "Save" }))) return;

    try {
      await updateUser({
        id: user.id,
        body: {
          name,
          email,
          role,
          permissions: selectedPermissions,
          departmentId,
          teamId,
          ...(role === "finance" ? { financeDepartmentIds } : {}),
          ...(password ? { password } : {}),
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
      <DialogTitle>Edit User</DialogTitle>

      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Stack spacing={3}>
            {/* Basic information */}
            <Stack spacing={2}>
              <TextField
                label="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                fullWidth
              />

              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                fullWidth
              />

              <TextField
                label="New Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                helperText="Leave blank to keep the current password."
                fullWidth
              />
            </Stack>

            {/* Role */}
            <FormControl fullWidth>
              <InputLabel id="edit-user-role-label">Role</InputLabel>

              <Select
                labelId="edit-user-role-label"
                value={roles ? role : ""}
                label="Role"
                disabled={rolesLoading || rolesError || isUpdating || isSelf}
                onChange={(event) => setRole(event.target.value as RoleName)}
              >
                {roles?.map((item) => (
                  <MenuItem key={item.id} value={item.name}>
                    {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
                  </MenuItem>
                ))}
              </Select>
              {isSelf && <FormHelperText>You cannot change your own role.</FormHelperText>}
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="edit-user-department-label">
                Department
              </InputLabel>
              <Select
                labelId="edit-user-department-label"
                value={departmentId}
                label="Department"
                onChange={(event) => {
                  setDepartmentId(event.target.value);
                  setTeamId("");
                }}
              >
                {departments?.map((department) => (
                  <MenuItem key={department.id} value={department.id}>
                    {department.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="edit-user-team-label">Team</InputLabel>
              <Select
                labelId="edit-user-team-label"
                value={teamId}
                label="Team"
                disabled={!departmentId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                {teams
                  ?.filter((team) => team.departmentId === departmentId)
                  .map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            {role === "finance" && (
              <FormControl fullWidth>
                <InputLabel id="finance-departments-label">Authorized departments</InputLabel>
                <Select
                  labelId="finance-departments-label"
                  label="Authorized departments"
                  multiple
                  value={financeDepartmentIds}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFinanceDepartmentIds(typeof value === "string" ? value.split(",") : value);
                  }}
                  renderValue={(selected) =>
                    selected
                      .map((id) => departments?.find((department) => department.id === id)?.name ?? id)
                      .join(", ")
                  }
                >
                  {departments?.map((department) => (
                    <MenuItem key={department.id} value={department.id}>
                      {department.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Departments whose approved expenses this Finance user may reimburse. Leave empty to use the user's own department.
                </FormHelperText>
              </FormControl>
            )}

            {/* Permissions */}
            <Stack spacing={2}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle1">Permissions</Typography>

                <Typography variant="body2" color="text.secondary">
                  Permissions are inherited from the selected role.
                </Typography>
              </Stack>

              {Object.entries(permissionGroups).map(
                ([groupName, groupPermissions]) => {
                  const availablePermissions = groupPermissions.filter(
                    (permission) => selectedPermissions.includes(permission),
                  );

                  if (!availablePermissions.length) {
                    return null;
                  }

                  return (
                    <Card key={groupName} variant="outlined">
                      <CardContent>
                        <Stack spacing={1.5}>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
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
                            {availablePermissions.map((permission) => (
                              <Chip
                                key={permission}
                                label={permission.split(".")[1]}
                                size="small"
                              />
                            ))}
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                },
              )}
            </Stack>

            {rolesError && (
              <Typography color="error">Roles could not be loaded. Refresh the page to try again.</Typography>
            )}

            {updateError && <ApiFeedback error={updateError} />}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button type="button" onClick={onClose} disabled={isUpdating}>
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
            {isUpdating ? "Saving…" : "Save Changes"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
