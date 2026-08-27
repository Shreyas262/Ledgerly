import type { ID } from "./common";
import type { Permission } from "./permissions";

export type UserRole = "employee" | "manager" | "finance" | "admin";

export interface User {
  id: ID;
  organizationId: ID;
  name: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
}

export interface AuthSession {
  user: User;
  sessionId: string;
  isAuthenticated: boolean;
}