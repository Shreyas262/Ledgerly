import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from "@mui/material";

import type { AuditAction, AuditEntityType } from "../types/audit";

interface AuditFiltersProps {
  action: AuditAction | "";
  entityType: AuditEntityType | "";
  onActionChange: (action: AuditAction | "") => void;
  onEntityTypeChange: (entityType: AuditEntityType | "") => void;
  onReset: () => void;
}

const actions: AuditAction[] = [
  "LOGIN",
  "LOGOUT",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DELETED",
  "ROLE_CREATED",
  "ROLE_UPDATED",
  "ROLE_DELETED",
  "PERMISSIONS_UPDATED",
  "EXPENSE_CREATED",
  "EXPENSE_UPDATED",
  "EXPENSE_SUBMITTED",
  "EXPENSE_REVIEWED",
  "EXPENSE_APPROVED",
  "EXPENSE_REJECTED",
  "EXPENSE_CANCELLED",
  "REIMBURSEMENT_STARTED",
  "REIMBURSEMENT_COMPLETED",
  "POLICY_CREATED",
  "POLICY_UPDATED",
  "POLICY_ACTIVATED",
  "POLICY_DEACTIVATED",
  "BUDGET_CREATED",
  "BUDGET_UPDATED",
  "BUDGET_CLOSED",
  "ADMIN_OVERRIDE",
];

const entityTypes: AuditEntityType[] = [
  "AUTHENTICATION",
  "USER",
  "ROLE",
  "ORGANIZATION",
  "DEPARTMENT",
  "TEAM",
  "EXPENSE",
  "POLICY",
  "BUDGET",
  "DOCUMENT",
  "REIMBURSEMENT",
];

export function AuditFilters({
  action,
  entityType,
  onActionChange,
  onEntityTypeChange,
  onReset,
}: AuditFiltersProps) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{
      alignItems: { xs: "stretch", sm: "center" },
    }}>
      <FormControl sx={{ minWidth: 220 }}>
        <InputLabel id="audit-action-label">Action</InputLabel>
        <Select
          labelId="audit-action-label"
          value={action}
          label="Action"
          onChange={(event) => onActionChange(event.target.value as AuditAction | "")}
        >
          <MenuItem value="">All actions</MenuItem>
          {actions.map((item) => (
            <MenuItem key={item} value={item}>{item}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl sx={{ minWidth: 200 }}>
        <InputLabel id="audit-entity-type-label">Entity</InputLabel>
        <Select
          labelId="audit-entity-type-label"
          value={entityType}
          label="Entity"
          onChange={(event) =>
            onEntityTypeChange(event.target.value as AuditEntityType | "")
          }
        >
          <MenuItem value="">All entities</MenuItem>
          {entityTypes.map((item) => (
            <MenuItem key={item} value={item}>{item}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button variant="outlined" onClick={onReset}>Reset</Button>
    </Stack>
  );
}
