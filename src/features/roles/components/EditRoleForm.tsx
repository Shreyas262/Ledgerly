import { useState } from "react";
import type { SyntheticEvent } from "react";

import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import type {
  Permission,
  Role,
  RoleName,
} from "../../../types/auth";

import { allPermissions } from "../../../mocks/data/permissions";

import { useUpdateRoleMutation } from "../api/rolesApi";

interface EditRoleFormProps {
  role: Role;
  onSuccess: () => void;
  onCancel: () => void;
}

const roleNames: RoleName[] = [
  "employee",
  "manager",
  "finance",
  "admin",
];

export function EditRoleForm({
  role,
  onSuccess,
  onCancel,
}: EditRoleFormProps) {
  const [name, setName] = useState<RoleName>(role.name);

  const [selectedPermissions, setSelectedPermissions] =
    useState<Permission[]>(role.permissions);

  const [
    updateRole,
    { isLoading, isError },
  ] = useUpdateRoleMutation();

  function handlePermissionChange(
    permission: Permission,
  ) {
    setSelectedPermissions((currentPermissions) => {
      if (currentPermissions.includes(permission)) {
        return currentPermissions.filter(
          (currentPermission) =>
            currentPermission !== permission,
        );
      }

      return [...currentPermissions, permission];
    });
  }

  async function handleSubmit(
    event: SyntheticEvent,
  ) {
    event.preventDefault();

    try {
      await updateRole({
        id: role.id,
        data: {
          name,
          permissions: selectedPermissions,
        },
      }).unwrap();

      onSuccess();
    } catch {
      // isError from RTK Query handles the UI state.
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>
        Edit Role
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Select
            value={name}
            onChange={(event) =>
              setName(event.target.value as RoleName)
            }
            fullWidth
          >
            {roleNames.map((roleName) => (
              <MenuItem
                key={roleName}
                value={roleName}
              >
                {roleName.charAt(0).toUpperCase() +
                  roleName.slice(1)}
              </MenuItem>
            ))}
          </Select>

          <Stack spacing={1}>
            <Typography variant="subtitle1">
              Permissions
            </Typography>

            <FormGroup>
              {allPermissions.map((permission) => (
                <FormControlLabel
                  key={permission}
                  control={
                    <Checkbox
                      checked={selectedPermissions.includes(
                        permission,
                      )}
                      onChange={() =>
                        handlePermissionChange(permission)
                      }
                    />
                  }
                  label={permission}
                />
              ))}
            </FormGroup>
          </Stack>

          {isError && (
            <Typography color="error">
              Failed to update role.
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          variant="contained"
          disabled={isLoading}
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </form>
  );
}