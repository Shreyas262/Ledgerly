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

/** Finance splits a department allocation across the department's teams. */
export interface TeamBudgetAllocation extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  organizationBudgetId: EntityId;
  departmentAllocationId: EntityId;
  departmentId: EntityId;
  teamId: EntityId;
  amount: number;
  currency: CurrencyCode;
}

/**
 * Expense-type budget within a team allocation. Records without
 * teamAllocationId are legacy department-level budgets (read-only).
 */
export interface ExpenseTypeBudget extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  organizationBudgetId: EntityId;
  departmentAllocationId: EntityId;
  departmentId: EntityId;
  teamAllocationId?: EntityId;
  teamId?: EntityId;
  expenseType: ExpenseType;
  amount: number;
  currency: CurrencyCode;
}

export interface BudgetUtilization {
  spentAmount: number;
  remainingAmount: number;
  utilizationPercent: number;
}

export type ExpenseTypeBudgetView = ExpenseTypeBudget & {
  utilization: BudgetUtilization;
};

export interface TeamBudgetView extends TeamBudgetAllocation {
  teamName: string;
  utilization: BudgetUtilization;
  expenseTypeBudgets: ExpenseTypeBudgetView[];
}

export interface DepartmentBudgetView extends DepartmentBudgetAllocation {
  departmentName: string;
  utilization: BudgetUtilization;
  teamAllocations: TeamBudgetView[];
  /** Active teams of the department, for allocation forms. */
  departmentTeams: Array<{ id: EntityId; name: string }>;
  /** Legacy department-level expense-type budgets (read-only). */
  expenseTypeBudgets: ExpenseTypeBudgetView[];
}

/** What part of the hierarchy the viewer may see. */
export type BudgetViewScope = "ORGANIZATION" | "DEPARTMENT" | "TEAM";

export interface OrganizationBudgetView extends OrganizationBudget {
  viewScope: BudgetViewScope;
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

export interface UpsertTeamAllocationRequest {
  organizationBudgetId: EntityId;
  departmentAllocationId: EntityId;
  teamId: EntityId;
  amount: number;
}

export interface UpsertExpenseTypeBudgetRequest {
  organizationBudgetId: EntityId;
  teamAllocationId: EntityId;
  expenseType: ExpenseType;
  amount: number;
}

// Retained as a compatibility shape for existing imports while the budget UI
// is migrated to the hierarchical model.
/** The current budget period and whether the caller may create expenses (§28.16). */
export interface ActiveBudgetPeriod {
  period: { name: string; startDate: string; endDate: string } | null;
  canCreateExpense: boolean;
  reason: string | null;
}

export type Budget = OrganizationBudget;
