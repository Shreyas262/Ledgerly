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

/** The action part of a permission as shown to users, e.g. "expenses.read" → "Read". */
export const permissionActionLabel = (permission: string): string => {
  const action = permission.split(".")[1] ?? permission;
  return action.charAt(0).toUpperCase() + action.slice(1);
};

/** Either Approvals tab: managerial review or finance reimbursement (§22.13). */
export const approvalPermissions: Permission[] = ["expenses.approve", "reimbursements.manage"];

/** Permissions that each open at least one Administration page. */
export const administrationPermissions: Permission[] = [
  "users.read",
  "roles.read",
  "organization.manage",
  "policies.read",
  "audit.read",
];

/**
 * Expense data scope comes from the built-in roles (§9); a custom role's
 * read permissions cover its holders' own expenses only.
 */
export const CUSTOM_ROLE_SCOPE_NOTE =
  "Expenses and analytics show holders of a custom role their own expenses only. Team, department and organization-wide expense data comes with the built-in Manager, Finance and Admin roles.";
