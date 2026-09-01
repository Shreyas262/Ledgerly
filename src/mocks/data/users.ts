import type { User } from "../../types/auth";

export const users: User[] = [
  {
    id: "user-1",
    organizationId: "org-1",
    name: "John Employee",
    email: "employee@ledgerly.com",
    role: "employee",
    permissions: [
      "expenses.read",
      "expenses.create",
      "expenses.update",
      "expenses.submit",
    ],
  },

  {
    id: "user-2",
    organizationId: "org-1",
    name: "Sarah Manager",
    email: "manager@ledgerly.com",
    role: "manager",
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
    id: "user-3",
    organizationId: "org-1",
    name: "Mike Finance",
    email: "finance@ledgerly.com",
    role: "finance",
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
    id: "user-4",
    organizationId: "org-1",
    name: "Admin User",
    email: "admin@ledgerly.com",
    role: "admin",
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