import type { EntityId } from "../../../types/common";

export interface UserProfile {
  id: EntityId;
  name: string;
  email: string;
  organizationId: EntityId;
  departmentId: EntityId;
  teamId: EntityId;
  roleId: EntityId;
}

export interface UpdateUserProfileRequest {
  name: string;
  email: string;
}