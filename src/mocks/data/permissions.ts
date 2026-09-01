import type { Permission } from "../../types/auth";

export const allPermissions: Permission[] = [
  "expenses.read",
  "expenses.create",
  "expenses.update",
  "expenses.submit",
  "expenses.approve",
  "expenses.reject",

  "users.read",
  "users.create",
  "users.update",
  "users.delete",

  "roles.read",
  "roles.create",
  "roles.update",
  "roles.delete",

  "policies.read",
  "policies.create",
  "policies.update",
  "policies.delete",

  "budgets.read",
  "budgets.create",
  "budgets.update",

  "analytics.read",

  "audit.read",
];

export const permissionGroups = {
  Expenses: [
    "expenses.read",
    "expenses.create",
    "expenses.update",
    "expenses.submit",
    "expenses.approve",
    "expenses.reject",
  ],

  Users: [
    "users.read",
    "users.create",
    "users.update",
    "users.delete",
  ],

  Roles: [
    "roles.read",
    "roles.create",
    "roles.update",
    "roles.delete",
  ],

  Policies: [
    "policies.read",
    "policies.create",
    "policies.update",
    "policies.delete",
  ],

  Budgets: [
    "budgets.read",
    "budgets.create",
    "budgets.update",
  ],

  Analytics: [
    "analytics.read",
  ],

  Audit: [
    "audit.read",
  ],
} satisfies Record<string, Permission[]>;