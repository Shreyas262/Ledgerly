import type { EntityId, ISODateString } from "../../../types/common";

export interface AuditEvent {
  id: EntityId;
  organizationId: EntityId;
  actorId: EntityId;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: EntityId;
  timestamp: ISODateString;
  previousState?: string;
  newState?: string;
  metadata?: Record<string, unknown>;
  description?: string;
}

export type AuditEntityType =
  | "AUTHENTICATION"
  | "USER"
  | "ROLE"
  | "ORGANIZATION"
  | "DEPARTMENT"
  | "TEAM"
  | "EXPENSE"
  | "POLICY"
  | "BUDGET"
  | "DOCUMENT"
  | "REIMBURSEMENT";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREDENTIAL_MIGRATED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "USER_DEACTIVATED"
  | "ROLE_CREATED"
  | "ROLE_UPDATED"
  | "ROLE_DELETED"
  | "ROLE_PERMISSIONS_UPDATED"
  | "PERMISSIONS_UPDATED"
  | "ORGANIZATION_UPDATED"
  | "ORGANIZATION_SETTINGS_UPDATED"
  | "DEPARTMENT_CREATED"
  | "DEPARTMENT_UPDATED"
  | "DEPARTMENT_DELETED"
  | "TEAM_CREATED"
  | "TEAM_UPDATED"
  | "TEAM_DELETED"
  | "EXPENSE_CREATED"
  | "EXPENSE_UPDATED"
  | "EXPENSE_SUBMITTED"
  | "EXPENSE_SUBMISSION_REJECTED"
  | "EXPENSE_RESTORED"
  | "EXPENSE_REVIEWED"
  | "EXPENSE_APPROVED"
  | "EXPENSE_REJECTED"
  | "EXPENSE_CANCELLED"
  | "REIMBURSEMENT_STARTED"
  | "REIMBURSEMENT_COMPLETED"
  | "POLICY_CREATED"
  | "POLICY_UPDATED"
  | "POLICY_ACTIVATED"
  | "POLICY_DEACTIVATED"
  | "BUDGET_CREATED"
  | "BUDGET_UPDATED"
  | "BUDGET_ALLOCATION_UPDATED"
  | "EXPENSE_TYPE_BUDGET_UPDATED"
  | "BUDGET_ACTIVATED"
  | "BUDGET_CLOSED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_REPLACED"
  | "DOCUMENT_REMOVED"
  | "ADMIN_OVERRIDE";
