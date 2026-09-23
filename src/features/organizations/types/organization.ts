import type { EntityId, ResourceTimestamps } from "../../../types/common";

export interface Organization extends ResourceTimestamps {
  id: EntityId;
  name: string;
  status: OrganizationStatus;
}

export type OrganizationStatus = "active" | "inactive";

export interface Department extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  name: string;
  status: DepartmentStatus;
}

export type DepartmentStatus = "active" | "inactive";

export interface Team extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  departmentId: EntityId;
  name: string;
  status: TeamStatus;
}

export type TeamStatus = "active" | "inactive";
