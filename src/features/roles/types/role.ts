import type { EntityId, ResourceTimestamps } from "../../../types/common";

export type RoleName = "employee" | "manager" | "finance" | "admin";

export type Permission =
  | "expenses.read"
  | "expenses.create"
  | "expenses.update"
  | "expenses.submit"
  | "expenses.approve"
  | "expenses.reject"
  | "expenses.delete"

  | "users.read"
  | "users.create"
  | "users.update"
  | "users.delete"

  | "roles.read"
  | "roles.create"
  | "roles.update"
  | "roles.delete"

  | "policies.read"
  | "policies.create"
  | "policies.update"
  | "policies.delete"

  | "budgets.read"
  | "budgets.create"
  | "budgets.update"
  | "budgets.delete"

  | "analytics.read"

  | "audit.read"

  | "reports.export"

  | "reimbursements.manage"

  | "departments.read"
  | "departments.manage"

  | "teams.read"
  | "teams.manage"

  | "documents.read"
  | "documents.create"
  | "documents.update"
  | "documents.delete"
  
  | "organization.read"
  | "organization.manage";

export interface Role extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  name: RoleName | string;
  description?: string;
  permissions: Permission[];
  isSystemRole: boolean;
}
