import type { EntityId, ISODateString } from "../../../types/common";
import type { Permission, RoleName } from "../../roles/types/role";

export interface Session {
  id: EntityId;
  userId: EntityId;
  organizationId: EntityId;
  createdAt: ISODateString;
  expiresAt: ISODateString;
  revokedAt?: ISODateString;
  status: SessionStatus;
}

export type SessionStatus = "active" | "expired" | "revoked";

export interface AuthUser {
  id: EntityId;
  organizationId: EntityId;
  departmentId: EntityId;
  teamId: EntityId;
  roleId: EntityId;
  name: string;
  email: string;
  role: RoleName | string;
  permissions: Permission[];
}

export interface AuthSession {
  user: AuthUser;
  sessionId: EntityId;
  expiresAt: ISODateString;
  isAuthenticated: true;
}

export interface AuthenticatedPrincipal {
  userId: EntityId;
  organizationId: EntityId;
  departmentId: EntityId;
  teamId: EntityId;
  roleId: EntityId;
  role: RoleName | string;
  effectivePermissions: Permission[];
}
