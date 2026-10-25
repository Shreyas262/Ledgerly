import type {
  EntityId,
  BaseCurrencyCode,
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
  currency: BaseCurrencyCode;
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
  currency: BaseCurrencyCode;
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
  currency: BaseCurrencyCode;
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
  currency: BaseCurrencyCode;
}

export interface BudgetUtilization {
  /** Reimbursed spend: the only spend that counts against the budget. */
  spentAmount: number;
  remainingAmount: number;
  utilizationPercent: number;
  /**
   * Approved expenses awaiting reimbursement, dated in the period (§28.8).
   * Shown separately and never counted as spend. Organization budgets only.
   */
  committedAmount?: number;
}

export type BudgetForecastStatus = "ON_TRACK" | "PROJECTED_OVER" | "OVER_COMMITTED";

/** Where a level of an active budget is heading at the pace so far (§28.19). */
export interface BudgetForecast {
  /** Days of the period so far, today included, and in the whole period. */
  elapsedDays: number;
  totalDays: number;
  /**
   * Spend at the period end if reimbursed and committed spend continue at
   * the average daily rate so far; null during the first week.
   */
  projectedAmount: number | null;
  /** What an even rate through the period would have used by today. */
  expectedByToday: number;
  /** When reimbursed and committed spend would reach the allocation at this pace, within the period. */
  runsOutOn: string | null;
  status: BudgetForecastStatus;
  /** How far the projection, or reimbursed and committed spend, goes over the allocation; 0 when on track. */
  overBy: number;
}

/** Reimbursed and committed spend dated up to and including `date`, from the period start. */
export interface BudgetTrendPoint {
  date: string;
  spentAmount: number;
  committedAmount: number;
}

/** The viewer's own level of an active budget, with its running totals for the forecast chart. */
export interface BudgetScopeForecast {
  allocated: number;
  spentAmount: number;
  committedAmount: number;
  forecast: BudgetForecast;
  /** Grouped like the analytics trend: by day up to 31 days, by week up to 92, by month beyond. */
  grouping: "day" | "week" | "month";
  trend: BudgetTrendPoint[];
}

export type ExpenseTypeBudgetView = ExpenseTypeBudget & {
  utilization: BudgetUtilization;
  forecast: BudgetForecast | null;
};

export interface TeamBudgetView extends TeamBudgetAllocation {
  teamName: string;
  utilization: BudgetUtilization;
  forecast: BudgetForecast | null;
  expenseTypeBudgets: ExpenseTypeBudgetView[];
}

export interface DepartmentBudgetView extends DepartmentBudgetAllocation {
  departmentName: string;
  utilization: BudgetUtilization;
  forecast: BudgetForecast | null;
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
  /** Forecasts exist only while the budget is active and today is within its period (§28.19). */
  forecast: BudgetForecast | null;
  /** The viewer's level: the organization budget, their departments together, or their team. */
  scopeForecast: BudgetScopeForecast | null;
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
