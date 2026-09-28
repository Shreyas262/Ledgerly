import { useConfirm } from "../../../components/common/ConfirmProvider";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
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
  TextField,
  Stack,
  Typography,
} from "@mui/material";

import type {
  Permission,
  Role,
  RoleName,
} from "../types/role";

import { allPermissions } from "../constants/permissions";

import { useUpdateRoleMutation } from "../api/rolesApi";

interface EditRoleFormProps {
  role: Role;
  onSuccess: () => void;
  onCancel: () => void;
}

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
    { isLoading, isError, error },
  ] = useUpdateRoleMutation();
  const confirm = useConfirm();

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
    if (!(await confirm({ title: "Save Role", message: `Save changes to the role "${name}"? Users with this role get the updated permissions immediately.`, confirmLabel: "Save" }))) return;

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
      <DialogTitle>Edit Role</DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField
            label="Role name"
            value={name}
            onChange={(event) => setName(event.target.value as RoleName)}
            fullWidth
            required
          />

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

          {isError && <ApiFeedback error={error} />}
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
          {isLoading ? "Saving…" : "Save Changes"}
        </Button>
      </DialogActions>
    </form>
  );
}