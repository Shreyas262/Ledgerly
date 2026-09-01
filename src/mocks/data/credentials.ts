import type { ID } from "../../types/common";

export interface MockCredential {
  userId: ID;
  email: string;
  password: string;
}

export const credentials: MockCredential[] = [
  {
    userId: "user-1",
    email: "employee@ledgerly.com",
    password: "employee123",
  },
  {
    userId: "user-2",
    email: "manager@ledgerly.com",
    password: "manager123",
  },
  {
    userId: "user-3",
    email: "finance@ledgerly.com",
    password: "finance123",
  },
  {
    userId: "user-4",
    email: "admin@ledgerly.com",
    password: "admin123",
  },
];