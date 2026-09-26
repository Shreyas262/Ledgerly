import type { EntityId, ResourceTimestamps } from "../../../types/common";
import type { Permission, RoleName } from "../../roles/types/role";

export interface User extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  departmentId: EntityId;
  teamId: EntityId;
  roleId: EntityId;
  name: string;
  email: string;
  status: UserStatus;
  role: RoleName | string;
  permissions: Permission[];
  financeDepartmentIds?: EntityId[];
}

export type UserStatus = "active" | "inactive" | "deleted";


export interface CreateUserPayload {
  organizationId?: EntityId;
  departmentId?: EntityId;
  teamId?: EntityId;
  roleId?: EntityId;
  name: string;
  email: string;
  role: RoleName;
  permissions: Permission[];
  password: string;
  status?: UserStatus;
  financeDepartmentIds?: EntityId[];
}

export interface UpdateUserPayload {
  name: string;
  email: string;
  role: RoleName;
  permissions: Permission[];
  departmentId?: EntityId;
  teamId?: EntityId;
  roleId?: EntityId;
  password?: string;
  status?: UserStatus;
  financeDepartmentIds?: EntityId[];
}
