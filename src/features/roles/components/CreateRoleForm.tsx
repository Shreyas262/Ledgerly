import { useState, type SyntheticEvent } from "react";
import {
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { allPermissions } from "../../../mocks/data/permissions";

import type { Permission, RoleName } from "../../../types/auth";
import { useCreateRoleMutation } from "../../roles/api/rolesApi";

export function CreateRoleForm() {
  const [name, setName] = useState<RoleName>("employee");
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [createRole, { isLoading, isError, error }] = useCreateRoleMutation();

  function handlePermissionChange(permission: Permission) {
    setPermissions((currentPermissions) => {
      if (currentPermissions.includes(permission)) {
        return currentPermissions.filter(
          (currentPermission) => currentPermission !== permission
        );
      }

      return [...currentPermissions, permission];
    });
  }
    if (isError && error) {
      console.log(error)
  }

  async function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();

    await createRole({
      name,
      permissions,
    }).unwrap();
  }

  return (
    <Stack
      component="form"
      spacing={3}
      onSubmit={handleSubmit}
    >
      <Typography variant="h6">
        Create Role
      </Typography>

      <TextField
        label="Role name"
        value={name}
        onChange={(event) =>
          setName(event.target.value as RoleName)
        }
      />

      <FormGroup>
        {allPermissions.map((permission) => (
          <FormControlLabel
            key={permission}
            control={
              <Checkbox
                checked={permissions.includes(permission)}
                onChange={() =>
                  handlePermissionChange(permission)
                }
              />
            }
            label={permission}
          />
        ))}
      </FormGroup>

      {isError && (
        <Typography color="error">
          Failed to create role.
        </Typography>
      )}

      <Button
        type="submit"
        variant="contained"
        disabled={isLoading}
      >
        {isLoading ? "Creating..." : "Create Role"}
      </Button>
    </Stack>
  );
}