import { Checkbox, FormControlLabel, FormGroup, FormLabel, Stack } from "@mui/material";

import { permissionActionLabel, permissionGroups } from "../constants/permissions";
import type { Permission } from "../types/role";

interface PermissionChecklistProps {
  value: readonly Permission[];
  onChange: (permissions: Permission[]) => void;
}

/** Permissions to grant, grouped by area and shown by action (Read, Create, …). */
export function PermissionChecklist({ value, onChange }: PermissionChecklistProps) {
  const toggle = (permission: Permission) =>
    onChange(value.includes(permission) ? value.filter((item) => item !== permission) : [...value, permission]);

  return (
    <Stack spacing={1.5}>
      {Object.entries(permissionGroups).map(([group, permissions]) => (
        <Stack key={group} component="fieldset" spacing={0.25} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
          <FormLabel component="legend" sx={{ typography: "subtitle2" }}>
            {group}
          </FormLabel>
          <FormGroup row>
            {permissions.map((permission) => (
              <FormControlLabel
                key={permission}
                control={<Checkbox checked={value.includes(permission)} onChange={() => toggle(permission)} />}
                label={permissionActionLabel(permission)}
              />
            ))}
          </FormGroup>
        </Stack>
      ))}
    </Stack>
  );
}
