import type { EntityId, ResourceTimestamps } from "../../../types/common";
import type { Permission, Role } from "../../roles/types/role";

export interface User extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  departmentId: EntityId;
  teamId: EntityId;
  roleId: EntityId;
  name: string;
  email: string;
  status: UserStatus;
  role?: Role;
  permissions: Permission[];
}

export type UserStatus = "active" | "inactive";
