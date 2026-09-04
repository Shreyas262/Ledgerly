export type PolicyStatus =
  | "active"
  | "inactive";

export interface ExpensePolicy {
  id: string;
  organizationId: string;

  name: string;
  description?: string;

  approvalLimit: number;

  status: PolicyStatus;

  createdAt: string;
  updatedAt: string;
}

export interface CreateExpensePolicyRequest {
  name: string;
  description?: string;
  approvalLimit: number;
  status: PolicyStatus;
}

export interface UpdateExpensePolicyRequest
  extends CreateExpensePolicyRequest {
  id: string;
}