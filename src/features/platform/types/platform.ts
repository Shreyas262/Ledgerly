import type { EntityId } from "../../../types/common";
import type { Organization } from "../../organizations/types/organization";

export interface OrganizationAdminSummary {
  id: EntityId;
  name: string;
  email: string;
}

/** An organization as platform operators see it. */
export interface PlatformOrganization extends Organization {
  userCount: number;
  admins: OrganizationAdminSummary[];
}

export interface CreateOrganizationRequest {
  name: string;
  admin: {
    name: string;
    email: string;
    password: string;
  };
}
