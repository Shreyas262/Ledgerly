import { useConfirm } from "../../../components/common/ConfirmProvider";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { useState, type SyntheticEvent } from "react";
import {
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { PermissionChecklist } from "./PermissionChecklist";

import type { Permission, RoleName } from "../types/role";
import { useCreateRoleMutation } from "../../roles/api/rolesApi";

interface CreateRoleFormProps { onSuccess?: () => void; }

export function CreateRoleForm({ onSuccess }: CreateRoleFormProps) {
  const [name, setName] = useState<RoleName>("employee");
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [createRole, { isLoading, isError, error }] = useCreateRoleMutation();
  const confirm = useConfirm();

  async function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    if (!(await confirm({ title: "Create Role", message: `Create the role "${name}" with ${permissions.length} permission(s)?`, confirmLabel: "Create" }))) return;

    try {
      await createRole({
        name,
        permissions,
      }).unwrap();
      setName("employee");
      setPermissions([]);
      onSuccess?.();
    } catch {
      // Error is exposed through the mutation state.
    }
  }

  return (
    <Stack
      component="form"
      spacing={3}
      onSubmit={handleSubmit}
    >
      <TextField
        label="Role name"
        value={name}
        onChange={(event) =>
          setName(event.target.value as RoleName)
        }
      />

      <Stack spacing={1}>
        <Typography variant="subtitle1">
          Permissions
        </Typography>
        <PermissionChecklist value={permissions} onChange={setPermissions} />
      </Stack>

      {isError && <ApiFeedback error={error} />}

      <Button
        type="submit"
        variant="contained"
        disabled={isLoading}
        sx={{ alignSelf: "flex-end" }}
      >
        {isLoading ? "Creating…" : "Create Role"}
      </Button>
    </Stack>
  );
}
