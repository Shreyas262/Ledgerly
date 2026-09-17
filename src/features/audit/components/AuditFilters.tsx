import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from "@mui/material";

import type { AuditAction, AuditResource } from "../../../types/audit";

interface AuditFiltersProps {
  action: AuditAction | "";
  resource: AuditResource | "";
  onActionChange: (action: AuditAction | "") => void;
  onResourceChange: (resource: AuditResource | "") => void;
  onReset: () => void;
}

const actions: AuditAction[] = [
  "create",
  "update",
  "delete",
  "submit",
  "approve",
  "reject",
  "login",
  "logout",
];

const resources: AuditResource[] = [
  "expense",
  "user",
  "role",
  "policy",
  "budget",
  "auth",
];

export function AuditFilters({
  action,
  resource,
  onActionChange,
  onResourceChange,
  onReset,
}: AuditFiltersProps) {
  return (
    <Stack
      direction={{
        xs: "column",
        sm: "row",
      }}
      spacing={2}
      sx={{
        alignItems: {
          xs: "stretch",
          sm: "center",
        },
      }}
    >
      <FormControl
        sx={{
          minWidth: 180,
        }}
      >
        <InputLabel id="audit-action-label">Action</InputLabel>

        <Select
          labelId="audit-action-label"
          value={action}
          label="Action"
          onChange={(event) =>
            onActionChange(event.target.value as AuditAction | "")
          }
        >
          <MenuItem value="">All actions</MenuItem>

          {actions.map((item) => (
            <MenuItem key={item} value={item}>
              {item}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl
        sx={{
          minWidth: 180,
        }}
      >
        <InputLabel id="audit-resource-label">Resource</InputLabel>

        <Select
          labelId="audit-resource-label"
          value={resource}
          label="Resource"
          onChange={(event) =>
            onResourceChange(event.target.value as AuditResource | "")
          }
        >
          <MenuItem value="">All resources</MenuItem>

          {resources.map((item) => (
            <MenuItem key={item} value={item}>
              {item}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button variant="outlined" onClick={onReset}>
        Reset
      </Button>
    </Stack>
  );
}
