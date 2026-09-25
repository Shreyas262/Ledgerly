import type { EntityId, ISODateString } from "../../../types/common";
import type { AuditAction, AuditEntityType } from "../../audit/types/audit";

/**
 * User-facing projection of an authoritative audit event (§24.4).
 */
export interface UserActivity {
  id: EntityId;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: EntityId;
  timestamp: ISODateString;
  previousState?: string;
  newState?: string;
  description?: string;
}
