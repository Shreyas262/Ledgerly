import type {
  EntityId,
  ISODateString,
  ResourceTimestamps,
} from "../../../types/common";
import type { ExpenseType } from "../../expenses/types/expense";

/** Whether a broken rule blocks submission or only warns reviewers. */
export type RuleEnforcement = "BLOCK" | "WARN";

export interface AmountRule {
  amount: number;
  enforcement: RuleEnforcement;
}

export interface DaysRule {
  days: number;
  enforcement: RuleEnforcement;
}

export interface ToggleRule {
  enforcement: RuleEnforcement;
}

/** The configurable rules of a policy (§21.4). Every rule is optional. */
export interface PolicyRules {
  /** Largest amount allowed for a single expense. */
  maximumAmount?: AmountRule;
  /** Above this amount the expense routes to a more senior approver (§22.3). */
  approvalThreshold?: number;
  /** Per-employee total per calendar month for the policy's expense type. */
  monthlyLimit?: AmountRule;
  /** The expense must be submitted within this many days of its date. */
  submissionDeadline?: DaysRule;
  /** Flags another expense by the same employee with the same type, amount and date. */
  duplicateCheck?: ToggleRule;
  /** Above this amount a detailed description (20+ characters) is required. */
  descriptionRequiredAbove?: AmountRule;
  /** The expense date cannot be in the future. */
  noFutureDates?: ToggleRule;
}

export type PolicyRuleKey = keyof PolicyRules;

/** Rule keys that produce findings, plus the baseline receipt rule. */
export type PolicyFindingRule = Exclude<PolicyRuleKey, "approvalThreshold"> | "receipt";

export interface Policy extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  name: string;
  description?: string;
  /** Omitted: applies to every expense type. */
  expenseType?: ExpenseType;
  /** Empty or omitted: applies to the whole organization. */
  departmentIds?: EntityId[];
  rules: PolicyRules;
  status: PolicyStatus;
  createdBy?: EntityId;
}

export type ExpensePolicy = Policy;

export type PolicyStatus = "draft" | "active" | "inactive";

export type PolicyEvaluationResult =
  | "COMPLIANT"
  | "REQUIRES_APPROVAL"
  | "VIOLATES_POLICY"
  | "MISSING_INFORMATION"
  | "NO_APPLICABLE_POLICY";

export interface PolicyFinding {
  rule: PolicyFindingRule;
  enforcement: RuleEnforcement;
  message: string;
}

export interface PolicyEvaluationDetails {
  /** Messages of blocking findings. */
  violatedRules?: string[];
  missingInformation?: string[];
  /** Messages of warning findings: submission proceeds, reviewers see them. */
  warnings?: string[];
  findings?: PolicyFinding[];
  requestedAmount?: number;
  applicableLimit?: number;
  approvalThreshold?: number;
  /** Above the approval threshold: routed to a more senior approver. */
  escalated?: boolean;
}

export interface PolicyEvaluation {
  policyId?: EntityId;
  policyName?: string;
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
  departmentIds?: EntityId[];
  rules: PolicyRules;
  status: PolicyStatus;
}

export interface UpdateExpensePolicyRequest extends CreateExpensePolicyRequest {
  id: EntityId;
}

/** The policy summary any signed-in user may read for an expense type (§21.12). */
export interface ApplicablePolicy {
  policy: Pick<Policy, "id" | "name" | "description" | "expenseType" | "departmentIds" | "rules"> | null;
  /** The caller's counted spend this month for the policy's expense type(s). */
  monthlyUsage: number;
  month: string;
}

export interface PolicyPreviewRequest {
  expenseType: ExpenseType;
  amount: number;
  expenseDate: string;
  departmentId: EntityId;
  description?: string;
  /** Simulated spend already counted this month (monthly limit). */
  monthlySpent?: number;
  /** Simulated submission date (deadline); defaults to today. */
  submissionDate?: string;
}

export interface PolicyPreviewResult {
  evaluation: PolicyEvaluation;
  policy: Policy | null;
}
