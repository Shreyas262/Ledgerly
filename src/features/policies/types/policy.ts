import type {
  EntityId,
  ISODateString,
  ResourceTimestamps,
} from "../../../types/common";
import type { ExpenseType } from "../../expenses/types/expense";

export interface Policy extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  name: string;
  description?: string;
  expenseType?: ExpenseType;
  approvalLimit: number;
  rule?: PolicyRule;
  status: PolicyStatus;
  createdBy?: EntityId;
}

export type ExpensePolicy = Policy;

export type PolicyStatus = "draft" | "active" | "inactive";

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

export interface PolicyEvaluationSnapshot extends PolicyEvaluation {
  id: EntityId;
  expenseId: EntityId;
  organizationId: EntityId;
}

export interface CreateExpensePolicyRequest {
  name: string;
  description?: string;
  expenseType?: ExpenseType;
  approvalLimit: number;
  rule?: PolicyRule;
  status: PolicyStatus;
}

export interface UpdateExpensePolicyRequest extends CreateExpensePolicyRequest {
  id: EntityId;
}
