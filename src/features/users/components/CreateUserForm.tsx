import { useConfirm } from "../../../components/common/ConfirmProvider";
import { useState } from "react";
import type { SyntheticEvent } from "react";

import {
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { RoleName } from "../../roles/types/role";

import { useCreateUserMutation } from "../api/usersApi";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { useGetRolesQuery } from "../../../features/roles/api/rolesApi";

import { GroupedPermissions } from "../../roles/components/GroupedPermissions";
import { useGetDepartmentsQuery, useGetTeamsQuery } from "../../organizations/api/organizationApi";

interface CreateUserFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateUserForm({
  onSuccess,
  onCancel,
}: CreateUserFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleName>("employee");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [financeDepartmentIds, setFinanceDepartmentIds] = useState<string[]>([]);

  const {
    data: roles,
    isLoading: rolesLoading,
    isError: rolesError,
  } = useGetRolesQuery();

  const { data: departments } = useGetDepartmentsQuery();
  const { data: teams } = useGetTeamsQuery();

  const [
    createUser,
    {
      isLoading: isCreating,
      error: createUserError,
    },
  ] = useCreateUserMutation();
  const confirm = useConfirm();

  const selectedRole = roles?.find(
    (item) => item.name === role,
  );

  const selectedPermissions =
    selectedRole?.permissions ?? [];

  async function handleSubmit(
    event: SyntheticEvent,
  ) {
    event.preventDefault();

    if (!departmentId || !teamId) {
      return;
    }
    if (!(await confirm({ title: "Create user", message: `Create an account for ${name} (${email})?`, confirmLabel: "Create" }))) return;

    try {
      await createUser({
        name,
        email,
        password,
        role,
        permissions: selectedPermissions,
        departmentId,
        teamId,
        ...(role === "finance" ? { financeDepartmentIds } : {}),
      }).unwrap();

      setName("");
      setEmail("");
      setPassword("");
      setRole("employee");
      setFinanceDepartmentIds([]);
      setDepartmentId("");
      setTeamId("");

      onSuccess?.();
    } catch {
      // Error is exposed through createUserError.
    }
  }

  return (
    <Stack
      component="form"
      onSubmit={handleSubmit}
      spacing={3}
    >
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
          label="Password"
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          required
          fullWidth
        />
      </Stack>

      {/* Role */}
      <FormControl fullWidth>
        <InputLabel id="user-role-label">
          Role
        </InputLabel>

        <Select
          labelId="user-role-label"
          value={roles ? role : ""}
          label="Role"
          disabled={rolesLoading || rolesError}
          onChange={(event) =>
            setRole(event.target.value as RoleName)
          }
        >
          {roles?.map((item) => (
            <MenuItem
              key={item.id}
              value={item.name}
            >
              {item.name.charAt(0).toUpperCase() +
                item.name.slice(1)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth required>
        <InputLabel id="user-department-label">Department</InputLabel>
        <Select labelId="user-department-label" value={departmentId} label="Department" onChange={(event) => { setDepartmentId(event.target.value); setTeamId(""); }}>
          {departments?.map((department) => <MenuItem key={department.id} value={department.id}>{department.name}</MenuItem>)}
        </Select>
      </FormControl>

      <FormControl fullWidth required>
        <InputLabel id="user-team-label">Team</InputLabel>
        <Select labelId="user-team-label" value={teamId} label="Team" disabled={!departmentId} onChange={(event) => setTeamId(event.target.value)}>
          {teams?.filter((team) => team.departmentId === departmentId).map((team) => <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>)}
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
          <Typography variant="subtitle1">
            Permissions
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            Permissions are inherited from the selected
            role.
          </Typography>
        </Stack>

        <GroupedPermissions permissions={selectedPermissions} />
      </Stack>

      {/* Errors */}
      {rolesError && (
        <Typography color="error">
          Failed to load roles.
        </Typography>
      )}

      {createUserError && <ApiFeedback error={createUserError} />}

      {/* Actions */}
      <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
        {onCancel && (
          <Button variant="outlined" onClick={onCancel} disabled={isCreating} sx={{ minWidth: 120 }}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="contained"
          disabled={
            isCreating ||
            rolesLoading ||
            rolesError ||
            !selectedRole
          }
          sx={{ minWidth: 140 }}
        >
          {isCreating ? "Creating..." : "Create User"}
        </Button>
      </Stack>
    </Stack>
  );
}