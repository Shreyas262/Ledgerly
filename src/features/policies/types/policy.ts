import type { EntityId, ISODateString, ResourceTimestamps } from "../../../types/common";
import type { ExpenseType } from "../../expenses/types/expense";

export interface Policy extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  name: string;
  description?: string;
  expenseType: ExpenseType;
  rule: PolicyRule;
  status: PolicyStatus;
  createdBy: EntityId;
}

export type PolicyStatus = "DRAFT" | "ACTIVE" | "INACTIVE";

export interface PolicyRule {
  maximumAmount?: number;
  approvalThreshold?: number;
  requiresReceipt?: boolean;
  allowedDepartments?: EntityId[];
  allowedRoles?: EntityId[];
  allowedProjects?: EntityId[];
  allowedCostCenters?: EntityId[];
}

export type PolicyEvaluationResult =
  | "COMPLIANT"
  | "REQUIRES_APPROVAL"
  | "VIOLATES_POLICY"
  | "MISSING_INFORMATION"
  | "NO_APPLICABLE_POLICY";

export interface PolicyEvaluationDetails {
  violatedRules?: string[];
  missingInformation?: string[];
  requestedAmount?: number;
  applicableLimit?: number;
  approvalThreshold?: number;
}

export interface PolicyEvaluation {
  policyId?: EntityId;
  result: PolicyEvaluationResult;
  evaluatedAt: ISODateString;
  details: PolicyEvaluationDetails;
}

export interface PolicyEvaluationSnapshot {
  policyId?: EntityId;
  result: PolicyEvaluationResult;
  evaluatedAt: ISODateString;
  details: PolicyEvaluationDetails;
}