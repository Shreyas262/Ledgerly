import type { ID } from "./common";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "submit"
  | "approve"
  | "reject"
  | "login"
  | "logout";

export type AuditResource =
  | "expense"
  | "user"
  | "role"
  | "policy"
  | "budget"
  | "auth";

export interface AuditLog {
  id: ID;
  organizationId: ID;
  actorId: ID;
  actorName: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId: ID;
  description: string;
  createdAt: string;
}