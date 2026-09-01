import type { Role, RoleName } from "../../types/auth";

export const roleNames: RoleName[] = [
  "employee",
  "manager",
  "finance",
  "admin",
];

export const roles: Role[] = [
  {
    id: "role-employee",
    name: "employee",
    permissions: [
      "expenses.read",
      "expenses.create",
      "expenses.update",
      "expenses.submit",
    ],
  },
  {
    id: "role-manager",
    name: "manager",
    permissions: [
      "expenses.read",
      "expenses.create",
      "expenses.update",
      "expenses.submit",
      "expenses.approve",
      "expenses.reject",
    ],
  },
  {
    id: "role-finance",
    name: "finance",
    permissions: [
      "expenses.read",
      "expenses.approve",
      "expenses.reject",
      "budgets.read",
      "budgets.create",
      "budgets.update",
      "analytics.read",
    ],
  },
  {
    id: "role-admin",
    name: "admin",
    permissions: [
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
    ],
  },
];