import type { Permission } from "../types/role";

export const permissionGroups: Record<string, Permission[]> = {
  "Expenses": [
    "expenses.read",
    "expenses.create",
    "expenses.update",
    "expenses.submit",
    "expenses.approve",
    "expenses.reject",
    "expenses.delete",
  ],
  "Users": [
    "users.read",
    "users.create",
    "users.update",
    "users.delete",
  ],
  "Roles": [
    "roles.read",
    "roles.create",
    "roles.update",
    "roles.delete",
  ],
  "Policies": [
    "policies.read",
    "policies.create",
    "policies.update",
    "policies.delete",
  ],
  "Budgets": [
    "budgets.read",
    "budgets.create",
    "budgets.update",
    "budgets.delete",
  ],
  "Analytics": [
    "analytics.read",
  ],
  "Audit": [
    "audit.read",
  ],
  "Reports": [
    "reports.export",
  ],
  "Reimbursements": [
    "reimbursements.manage",
  ],
  "Departments": [
    "departments.read",
    "departments.manage",
  ],
  "Teams": [
    "teams.read",
    "teams.manage",
  ],
  "Documents": [
    "documents.read",
    "documents.create",
    "documents.update",
    "documents.delete",
  ],
  "Organization": [
    "organization.read",
    "organization.manage",
  ],
};

export const allPermissions: Permission[] = Object.values(permissionGroups).flat();
/** Permissions that each open at least one Administration page. */
export const administrationPermissions: Permission[] = [
  "users.read",
  "roles.read",
  "organization.manage",
  "policies.read",
  "audit.read",
];
