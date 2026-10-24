import type {
  BaseCurrencyCode,
  CurrencyCode,
  EntityId,
  ISODateString,
  ResourceTimestamps,
} from "../../../types/common";
import type { CurrencyConversion } from "../../currency/types/currency";
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

/** Display labels for the controlled expense-type values (§21.2). */
export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  MEALS: "Meals",
  TRAVEL: "Travel",
  ACCOMMODATION: "Accommodation",
  TRANSPORTATION: "Transportation",
  ENTERTAINMENT: "Entertainment",
  OFFICE_SUPPLIES: "Office Supplies",
  COMMUNICATION: "Communication",
  TRAINING: "Training",
  OTHER: "Other",
};

export const EXPENSE_TYPES = Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[];

/** Resource scope an expense collection is requested for. */
export type ExpenseScope = "OWN" | "TEAM" | "DEPARTMENT" | "ORGANIZATION";

export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "rejected"
  | "approved"
  | "reimbursement_pending"
  | "reimbursed"
  | "cancelled";

/** Display labels for expense statuses, shared by every screen. */
export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  rejected: "Rejected",
  approved: "Approved",
  reimbursement_pending: "Reimbursement pending",
  reimbursed: "Reimbursed",
  cancelled: "Cancelled",
};

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
  /** Display name of processedBy, resolved by the API. */
  processedByName?: string;
  reference?: string;
  notes?: string;
}

export interface Expense extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  departmentId: EntityId;
  teamId: EntityId;
  employeeId: EntityId;
  /** Owner display name, resolved by the API for read responses. */
  employeeName?: string;
  /** True when the owner has been removed from the organization. */
  employeeRemoved?: boolean;
  /** Team and department display names, resolved by the API. */
  teamName?: string;
  departmentName?: string;
  type: ExpenseType;
  title: string;
  /** In rupees: what policies, budgets, reimbursement and reports use. */
  amount: number;
  currency: BaseCurrencyCode;
  /** Present when the expense was paid in another currency and converted to the rupee amount. */
  conversion?: CurrencyConversion;
  /** Not captured yet; reserved for merchant-based duplicate checks. */
  merchant?: string;
  description: string;
  expenseDate: ISODateString;
  projectId?: EntityId;
  costCenterId?: EntityId;
  status: ExpenseStatus;
  documentIds: EntityId[];
  policyId?: EntityId;
  policyEvaluation?: PolicyEvaluation;
  submittedAt?: ISODateString;
  /** Who started the review in progress; only they or an administrator complete it. */
  reviewStartedBy?: EntityId;
  reviewStartedAt?: ISODateString;
  /** Display name of reviewStartedBy, resolved by the API. */
  reviewStartedByName?: string;
  reviewedAt?: ISODateString;
  reviewedBy?: EntityId;
  approvedBy?: EntityId;
  /**
   * True when the Finance user who approved the expense may also reimburse
   * it, because it belongs to the only administrator. Resolved by the API.
   */
  approverMayReimburse?: boolean;
  /**
   * For an expense awaiting reimbursement whose date only a closed budget
   * covers: that budget's name, as the reimbursement still counts against it.
   * Resolved by the API.
   */
  closedBudgetName?: string;
  rejectionReason?: string;
  /** Who rejected the expense last, and when; kept after it is resubmitted. */
  rejectedBy?: EntityId;
  rejectedAt?: ISODateString;
  /** Display name of rejectedBy, resolved by the API. */
  rejectedByName?: string;
  reimbursement?: ReimbursementInfo;
  cancelledAt?: ISODateString;
  cancelledBy?: EntityId;
  /** Display name of cancelledBy, resolved by the API. */
  cancelledByName?: string;
  cancellationReason?: string;
  /** Non-blocking budget notices returned when the expense is submitted. */
  budgetWarnings?: string[];
}


export interface CreateExpenseRequest {
  type: ExpenseType;
  title: string;
  description: string;
  /** The amount as paid, in `currency`; the API converts other currencies to rupees. */
  amount: number;
  currency: CurrencyCode;
  expenseDate: ISODateString;
}

export interface UpdateExpenseRequest extends CreateExpenseRequest {
  id: EntityId;
}

/** Most drafts submitted at once: one page of the expense list. */
export const MAX_BULK_SUBMIT = 25;

/** What happened to one draft of a bulk submission, in request order. */
export type BulkSubmitResult =
  | { expenseId: EntityId; ok: true; expense: Expense }
  | { expenseId: EntityId; ok: false; status: number; code: string; message: string };

export interface ExpenseFilter {
  search: string;
  status: ExpenseStatus | "all";
  type: ExpenseType | "all";
  dateFrom: string;
  dateTo: string;
}

export const initialExpenseFilters: ExpenseFilter = {
  search: "",
  status: "all",
  type: "all",
  dateFrom: "",
  dateTo: "",
};
