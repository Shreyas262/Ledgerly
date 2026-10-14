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

/**
 * Organization accounts belong to an organization; personal accounts manage
 * their own spending and have no organization, role or permissions (§5.15).
 * Platform accounts operate Ledgerly itself: they create organizations and
 * their first Admin, and hold no organization role or permissions.
 */
export type AccountType = "organization" | "personal" | "platform";

export interface AuthUser {
  id: EntityId;
  /** Missing on records created before personal accounts; treated as organization. */
  accountType?: AccountType;
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
  /** Display names resolved by the API for the IDs above. */
  organizationName?: string;
  departmentName?: string;
  teamName?: string;
  authorizedDepartmentNames?: string[];
}

export interface AuthSession {
  user: AuthUser;
  sessionId: EntityId;
  expiresAt: ISODateString;
  isAuthenticated: true;
}

export interface AuthenticatedPrincipal {
  userId: EntityId;
  accountType: AccountType;
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
