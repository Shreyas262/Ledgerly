import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";

import { FilterBar } from "../../../components/common/FilterBar";
import { humanize } from "../../../utils/format";
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
  "PASSWORD_CHANGED",
  "SESSIONS_REVOKED",
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
  const activeCount = (action ? 1 : 0) + (entityType ? 1 : 0);

  return (
    <FilterBar label="Audit filters" activeCount={activeCount} onReset={onReset}>
      <FormControl size="small">
        <InputLabel id="audit-action-label">Action</InputLabel>
        <Select
          labelId="audit-action-label"
          value={action}
          label="Action"
          onChange={(event) => onActionChange(event.target.value as AuditAction | "")}
        >
          <MenuItem value="">All actions</MenuItem>
          {actions.map((item) => (
            <MenuItem key={item} value={item}>{humanize(item)}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small">
        <InputLabel id="audit-entity-type-label">Record type</InputLabel>
        <Select
          labelId="audit-entity-type-label"
          value={entityType}
          label="Record type"
          onChange={(event) =>
            onEntityTypeChange(event.target.value as AuditEntityType | "")
          }
        >
          <MenuItem value="">All record types</MenuItem>
          {entityTypes.map((item) => (
            <MenuItem key={item} value={item}>{humanize(item)}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </FilterBar>
  );
}
