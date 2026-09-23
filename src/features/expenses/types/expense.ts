import type {
  CurrencyCode,
  EntityId,
  ISODateString,
  ResourceTimestamps,
} from "../../../types/common";
import type { PolicyEvaluation } from "../../policies/types/policy";

export type ExpenseType =
  | "MEALS"
  | "TRAVEL"
  | "ACCOMMODATION"
  | "TRANSPORTATION"
  | "ENTERTAINMENT"
  | "OFFICE_SUPPLIES"
  | "COMMUNICATION"
  | "TRAINING"
  | "OTHER";

export type ExpenseStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REJECTED"
  | "APPROVED"
  | "REIMBURSEMENT_PENDING"
  | "REIMBURSED"
  | "CANCELLED";

export type ReimbursementStatus =
  | "NOT_APPLICABLE"
  | "PENDING"
  | "PROCESSING"
  | "REIMBURSED"
  | "CANCELLED";

export interface ReimbursementInfo {
  status: ReimbursementStatus;
  amount?: number;
  processedAt?: ISODateString;
  processedBy?: EntityId;
  reference?: string;
  notes?: string;
}

export interface Expense extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  departmentId: EntityId;
  teamId: EntityId;
  employeeId: EntityId;
  type: ExpenseType;
  amount: number;
  currency: CurrencyCode;
  merchant: string;
  description: string;
  expenseDate: ISODateString;
  projectId?: EntityId;
  costCenterId?: EntityId;
  status: ExpenseStatus;
  documentIds: EntityId[];
  policyId?: EntityId;
  policyEvaluation?: PolicyEvaluation;
  submittedAt?: ISODateString;
  reviewedAt?: ISODateString;
  reviewedBy?: EntityId;
  approvedBy?: EntityId;
  rejectionReason?: string;
  reimbursement?: ReimbursementInfo;
  cancelledAt?: ISODateString;
  cancelledBy?: EntityId;
}
