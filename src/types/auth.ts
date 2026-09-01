import type { ID } from "./common";

export type RoleName =
  | "employee"
  | "manager"
  | "finance"
  | "admin";

export type Permission =
  // Expenses
  | "expenses.read"
  | "expenses.create"
  | "expenses.update"
  | "expenses.submit"
  | "expenses.approve"
  | "expenses.reject"

  // Users
  | "users.read"
  | "users.create"
  | "users.update"
  | "users.delete"

  // Roles
  | "roles.read"
  | "roles.create"
  | "roles.update"
  | "roles.delete"

  // Policies
  | "policies.read"
  | "policies.create"
  | "policies.update"
  | "policies.delete"

  // Budgets
  | "budgets.read"
  | "budgets.create"
  | "budgets.update"

  // Analytics
  | "analytics.read"

  // Audit
  | "audit.read";

export interface Role {
  id: ID;
  name: RoleName;
  permissions: Permission[];
}

export interface CreateRolePayload {
  name: RoleName;
  permissions: Permission[];
}

export interface UpdateRolePayload {
  name: RoleName;
  permissions: Permission[];
}

export interface User {
  id: ID;
  organizationId: ID;
  name: string;
  email: string;
  role: RoleName;
  permissions: Permission[];
}

export interface AuthSession {
  user: User;
  sessionId: string;
  isAuthenticated: boolean;
}

export interface CreateUserPayload {
  organizationId: ID;
  name: string;
  email: string;
  password: string;
  role: RoleName;
  permissions: Permission[];
}

export interface UpdateUserPayload {
  name: string;
  email: string;
  password?: string;
  role: RoleName;
  permissions: Permission[];
}