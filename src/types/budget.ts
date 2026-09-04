export type BudgetStatus =
  | "active"
  | "exhausted"
  | "expired";

export interface Budget {
  id: string;
  organizationId: string;

  name: string;
  description?: string;

  amount: number;
  spentAmount: number;

  currency: "INR";

  department?: string;
  project?: string;

  startDate: string;
  endDate: string;

  status: BudgetStatus;

  createdAt: string;
  updatedAt: string;
}

export interface CreateBudgetRequest {
  name: string;
  description?: string;
  amount: number;
  department?: string;
  project?: string;
  startDate: string;
  endDate: string;
}

export interface UpdateBudgetRequest
  extends CreateBudgetRequest {
  id: string;
}