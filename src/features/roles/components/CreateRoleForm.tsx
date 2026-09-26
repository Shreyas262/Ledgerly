import { ApiFeedback } from "../../../components/common/ApiFeedback";
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

import { allPermissions } from "../constants/permissions";

import type { Permission, RoleName } from "../types/role";
import { useCreateRoleMutation } from "../../roles/api/rolesApi";

interface CreateRoleFormProps { onSuccess?: () => void; }

export function CreateRoleForm({ onSuccess }: CreateRoleFormProps) {
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
    setName("employee");
    setPermissions([]);
    onSuccess?.();
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

      {isError && <ApiFeedback error={error} />}

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