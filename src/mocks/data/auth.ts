import type { User } from "../../types/auth";

export const mockUser: User = {
  id: "user-001",
  organizationId: "org-001",
  name: "Alex Morgan",
  email: "alex@ledgerly.dev",
  role: "employee",
  permissions: [
    "expenses.read",
    "expenses.create",
    "expenses.update",
    "expenses.submit",
  ],
};

export const mockCredentials = {
  email: "alex@ledgerly.dev",
  password: "password123",
};