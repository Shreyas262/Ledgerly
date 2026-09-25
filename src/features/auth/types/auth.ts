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
  /** Departments whose financial records the user may process (§22.7). */
  authorizedDepartmentIds?: EntityId[];
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
  /**
   * Departments within DEPARTMENT scope. Finance authority is an explicit
   * assignment (§22.7); otherwise it is the user's own department.
   */
  authorizedDepartmentIds: EntityId[];
}
