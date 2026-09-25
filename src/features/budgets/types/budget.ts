import type {
  EntityId,
  CurrencyCode,
  ISODateString,
  ResourceTimestamps,
} from "../../../types/common";
import type { ExpenseType } from "../../expenses/types/expense";

export type BudgetStatus = "draft" | "active" | "closed";

export interface OrganizationBudget extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  name: string;
  description?: string;
  amount: number;
  currency: CurrencyCode;
  startDate: ISODateString;
  endDate: ISODateString;
  status: BudgetStatus;
  createdBy: EntityId;
}

export interface DepartmentBudgetAllocation extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  organizationBudgetId: EntityId;
  departmentId: EntityId;
  amount: number;
  currency: CurrencyCode;
}

export interface ExpenseTypeBudget extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  organizationBudgetId: EntityId;
  departmentAllocationId: EntityId;
  departmentId: EntityId;
  expenseType: ExpenseType;
  amount: number;
  currency: CurrencyCode;
}

export interface BudgetUtilization {
  spentAmount: number;
  remainingAmount: number;
  utilizationPercent: number;
}

export interface DepartmentBudgetView extends DepartmentBudgetAllocation {
  departmentName: string;
  utilization: BudgetUtilization;
  expenseTypeBudgets: Array<ExpenseTypeBudget & {
    utilization: BudgetUtilization;
  }>;
}

export interface OrganizationBudgetView extends OrganizationBudget {
  utilization: BudgetUtilization;
  departmentAllocations: DepartmentBudgetView[];
}

export interface CreateOrganizationBudgetRequest {
  name: string;
  description?: string;
  amount: number;
  startDate: ISODateString;
  endDate: ISODateString;
}

export interface UpdateOrganizationBudgetRequest
  extends CreateOrganizationBudgetRequest {
  id: EntityId;
}

export interface UpsertDepartmentAllocationRequest {
  organizationBudgetId: EntityId;
  departmentId: EntityId;
  amount: number;
}

export interface UpsertExpenseTypeBudgetRequest {
  organizationBudgetId: EntityId;
  departmentAllocationId: EntityId;
  departmentId: EntityId;
  expenseType: ExpenseType;
  amount: number;
}

// Retained as a compatibility shape for existing imports while the budget UI
// is migrated to the hierarchical model.
export type Budget = OrganizationBudget;
export type CreateBudgetRequest = CreateOrganizationBudgetRequest;
export type UpdateBudgetRequest = UpdateOrganizationBudgetRequest;
