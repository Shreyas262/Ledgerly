import type { EntityId, CurrencyCode, ISODateString, ResourceTimestamps } from "../../../types/common";
import type { ExpenseType } from "../../expenses/types/expense";

export interface Budget extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  departmentId?: EntityId;
  expenseType?: ExpenseType;
  name: string;
  amount: number;
  currency: CurrencyCode;
  period: BudgetPeriod;
  status: BudgetStatus;
  parentBudgetId?: EntityId;
  createdBy: EntityId;
}

export interface BudgetPeriod {
  startDate: ISODateString;
  endDate: ISODateString;
}

export type BudgetStatus = "DRAFT" | "ACTIVE" | "CLOSED";
