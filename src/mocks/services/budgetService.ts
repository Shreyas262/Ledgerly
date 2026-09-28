import type { Expense, ExpenseType } from "../../features/expenses/types/expense";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type {
  BudgetUtilization,
  BudgetViewScope,
  DepartmentBudgetAllocation,
  ExpenseTypeBudget,
  OrganizationBudget,
  OrganizationBudgetView,
  TeamBudgetAllocation,
} from "../../features/budgets/types/budget";
import { EXPENSE_TYPE_LABELS } from "../../features/expenses/types/expense";
import { listRecords, listRecordsByIndex } from "./mockDataService";

/**
 * Budget hierarchy (§28): organization budget → department allocations
 * (admin) → team allocations (finance) → expense-type budgets per team
 * (finance). Utilization is derived from reimbursed expenses only — genuine,
 * completed spending — within the budget period.
 */

interface NamedRecord {
  id: string;
  name: string;
  departmentId?: string;
  status?: string;
}

function utilization(amount: number, spentAmount: number): BudgetUtilization {
  return {
    spentAmount,
    remainingAmount: Math.max(amount - spentAmount, 0),
    utilizationPercent: amount > 0 ? (spentAmount / amount) * 100 : 0,
  };
}

async function reimbursedExpensesInPeriod(budget: OrganizationBudget): Promise<Expense[]> {
  const expenses = await listRecordsByIndex<Expense>("expenses", "organizationId", budget.organizationId);
  return expenses.filter(
    (expense) =>
      expense.status === "reimbursed" &&
      expense.expenseDate >= budget.startDate &&
      expense.expenseDate <= budget.endDate,
  );
}

function sumWhere(expenses: Expense[], predicate: (expense: Expense) => boolean): number {
  return expenses.reduce((total, expense) => (predicate(expense) ? total + expense.amount : total), 0);
}

/** Which slice of a budget a principal may see. */
export function resolveBudgetScope(principal: AuthenticatedPrincipal): BudgetViewScope | null {
  switch (principal.role) {
    case "admin":
      return "ORGANIZATION";
    case "finance":
      return "DEPARTMENT";
    case "manager":
      return "TEAM";
    default:
      return null;
  }
}

export async function loadBudgetHierarchy() {
  const [departments, teams, departmentAllocations, teamAllocations, expenseTypeBudgets] = await Promise.all([
    listRecords<NamedRecord>("departments"),
    listRecords<NamedRecord>("teams"),
    listRecords<DepartmentBudgetAllocation>("departmentBudgetAllocations"),
    listRecords<TeamBudgetAllocation>("teamBudgetAllocations"),
    listRecords<ExpenseTypeBudget>("expenseTypeBudgets"),
  ]);
  return { departments, teams, departmentAllocations, teamAllocations, expenseTypeBudgets };
}

/** Whether the principal can see any part of the budget. */
export async function isBudgetVisibleTo(
  principal: AuthenticatedPrincipal,
  budget: OrganizationBudget,
): Promise<boolean> {
  const scope = resolveBudgetScope(principal);
  if (!scope || budget.organizationId !== principal.organizationId) return false;
  if (scope === "ORGANIZATION") return true;

  const { departmentAllocations, teamAllocations } = await loadBudgetHierarchy();
  if (scope === "DEPARTMENT") {
    return departmentAllocations.some(
      (allocation) =>
        allocation.organizationBudgetId === budget.id &&
        principal.authorizedDepartmentIds.includes(allocation.departmentId),
    );
  }
  return teamAllocations.some(
    (allocation) => allocation.organizationBudgetId === budget.id && allocation.teamId === principal.teamId,
  );
}

/** Builds the budget view, limited to what the principal may see. */
export async function buildBudgetView(
  budget: OrganizationBudget,
  principal: AuthenticatedPrincipal,
): Promise<OrganizationBudgetView> {
  const scope = resolveBudgetScope(principal) ?? "TEAM";
  const [hierarchy, spent] = await Promise.all([loadBudgetHierarchy(), reimbursedExpensesInPeriod(budget)]);
  const nameOf = (items: NamedRecord[], id: string) => items.find((item) => item.id === id)?.name ?? id;

  const typeView = (typeBudget: ExpenseTypeBudget) => ({
    ...typeBudget,
    utilization: utilization(
      typeBudget.amount,
      sumWhere(spent, (expense) =>
        (typeBudget.teamId ? expense.teamId === typeBudget.teamId : expense.departmentId === typeBudget.departmentId) &&
        expense.type === typeBudget.expenseType),
    ),
  });

  const departmentAllocations = hierarchy.departmentAllocations
    .filter((allocation) => allocation.organizationBudgetId === budget.id)
    .filter((allocation) =>
      scope === "ORGANIZATION" ||
      (scope === "DEPARTMENT" && principal.authorizedDepartmentIds.includes(allocation.departmentId)) ||
      (scope === "TEAM" && allocation.departmentId === principal.departmentId))
    .map((allocation) => {
      const teamAllocations = hierarchy.teamAllocations
        .filter((team) => team.departmentAllocationId === allocation.id)
        .filter((team) => scope !== "TEAM" || team.teamId === principal.teamId)
        .map((team) => ({
          ...team,
          teamName: nameOf(hierarchy.teams, team.teamId),
          utilization: utilization(team.amount, sumWhere(spent, (expense) => expense.teamId === team.teamId)),
          expenseTypeBudgets: hierarchy.expenseTypeBudgets
            .filter((typeBudget) => typeBudget.teamAllocationId === team.id)
            .map(typeView),
        }));

      return {
        ...allocation,
        departmentName: nameOf(hierarchy.departments, allocation.departmentId),
        utilization: utilization(
          allocation.amount,
          sumWhere(spent, (expense) => expense.departmentId === allocation.departmentId),
        ),
        teamAllocations,
        departmentTeams: scope === "TEAM"
          ? []
          : hierarchy.teams
              .filter((team) => team.departmentId === allocation.departmentId && team.status !== "inactive")
              .map((team) => ({ id: team.id, name: team.name })),
        expenseTypeBudgets: scope === "TEAM"
          ? []
          : hierarchy.expenseTypeBudgets
              .filter((typeBudget) => typeBudget.departmentAllocationId === allocation.id && !typeBudget.teamAllocationId)
              .map(typeView),
      };
    })
    // Managers only see the department that holds their team's allocation.
    .filter((allocation) => scope !== "TEAM" || allocation.teamAllocations.length > 0);

  return {
    ...budget,
    viewScope: scope,
    utilization: utilization(budget.amount, sumWhere(spent, () => true)),
    departmentAllocations,
  };
}

/** Today's date (YYYY-MM-DD). */
export function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** The active organization budget whose period covers the date, if any. */
export async function findActiveBudgetForDate(
  organizationId: string,
  date: string,
): Promise<OrganizationBudget | undefined> {
  const budgets = await listRecords<OrganizationBudget>("budgets");
  return budgets.find(
    (budget) =>
      budget.organizationId === organizationId &&
      budget.status === "active" &&
      budget.startDate <= date &&
      date <= budget.endDate,
  );
}

export interface ExpenseCreationEligibility {
  budget?: OrganizationBudget;
  allowed: boolean;
  code?: "NO_ACTIVE_BUDGET" | "NO_DEPARTMENT_ALLOCATION" | "NO_TEAM_ALLOCATION";
  reason?: string;
}

/**
 * §28.16: expenses may be created only while an active budget covers today
 * and allocates a positive amount to the creator's department and team.
 */
export async function getExpenseCreationEligibility(
  principal: Pick<AuthenticatedPrincipal, "organizationId" | "departmentId" | "teamId">,
): Promise<ExpenseCreationEligibility> {
  const budget = await findActiveBudgetForDate(principal.organizationId, todayDate());
  if (!budget) {
    return {
      allowed: false,
      code: "NO_ACTIVE_BUDGET",
      reason: "Expenses cannot be created at present because there is no active budget for the current period. Ask an administrator to activate a budget.",
    };
  }
  const departmentAllocation = (await listRecordsByIndex<DepartmentBudgetAllocation>(
    "departmentBudgetAllocations", "organizationBudgetId", budget.id,
  )).find((allocation) => allocation.departmentId === principal.departmentId && allocation.amount > 0);
  if (!departmentAllocation) {
    return {
      budget,
      allowed: false,
      code: "NO_DEPARTMENT_ALLOCATION",
      reason: "Expenses cannot be created yet because your department has no allocation in the active budget. Ask an administrator to allocate it.",
    };
  }
  const teamAllocation = (await listRecordsByIndex<TeamBudgetAllocation>(
    "teamBudgetAllocations", "organizationBudgetId", budget.id,
  )).find((allocation) => allocation.teamId === principal.teamId && allocation.amount > 0);
  if (!teamAllocation) {
    return {
      budget,
      allowed: false,
      code: "NO_TEAM_ALLOCATION",
      reason: "Expenses cannot be created yet because your team has no allocation in the active budget. Ask Finance to allocate it.",
    };
  }
  return { budget, allowed: true };
}

/** Active organization budgets whose periods overlap the given period. */
export async function findOverlappingActiveBudget(
  organizationId: string,
  startDate: string,
  endDate: string,
  excludeBudgetId?: string,
): Promise<OrganizationBudget | undefined> {
  const budgets = await listRecords<OrganizationBudget>("budgets");
  return budgets.find(
    (budget) =>
      budget.id !== excludeBudgetId &&
      budget.organizationId === organizationId &&
      budget.status === "active" &&
      budget.startDate <= endDate &&
      startDate <= budget.endDate,
  );
}

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/**
 * Non-blocking budget notices for an expense being submitted: would it take
 * its team's expense-type budget, team allocation or department allocation
 * over the limit once reimbursed?
 */
export async function getBudgetWarnings(expense: Expense): Promise<string[]> {
  const budgets = await listRecords<OrganizationBudget>("budgets");
  const budget = budgets.find(
    (item) =>
      item.organizationId === expense.organizationId &&
      item.status === "active" &&
      item.startDate <= expense.expenseDate &&
      expense.expenseDate <= item.endDate,
  );
  if (!budget) return [];

  const [hierarchy, spent] = await Promise.all([loadBudgetHierarchy(), reimbursedExpensesInPeriod(budget)]);
  const warnings: string[] = [];
  const check = (label: string, allocated: number, alreadySpent: number) => {
    if (alreadySpent + expense.amount > allocated) {
      warnings.push(
        `This expense would take ${label} over budget: ${money(alreadySpent)} spent + ${money(expense.amount)} exceeds ${money(allocated)}.`,
      );
    }
  };

  const departmentAllocation = hierarchy.departmentAllocations.find(
    (allocation) => allocation.organizationBudgetId === budget.id && allocation.departmentId === expense.departmentId,
  );
  const teamAllocation = departmentAllocation
    ? hierarchy.teamAllocations.find(
        (allocation) => allocation.departmentAllocationId === departmentAllocation.id && allocation.teamId === expense.teamId,
      )
    : undefined;
  const typeBudget = teamAllocation
    ? hierarchy.expenseTypeBudgets.find(
        (item) => item.teamAllocationId === teamAllocation.id && item.expenseType === expense.type,
      )
    : undefined;

  if (typeBudget) {
    check(
      `the team's ${EXPENSE_TYPE_LABELS[expense.type as ExpenseType] ?? expense.type} budget`,
      typeBudget.amount,
      sumWhere(spent, (item) => item.teamId === expense.teamId && item.type === expense.type),
    );
  }
  if (teamAllocation) {
    check("the team budget", teamAllocation.amount, sumWhere(spent, (item) => item.teamId === expense.teamId));
  }
  if (departmentAllocation) {
    check(
      "the department budget",
      departmentAllocation.amount,
      sumWhere(spent, (item) => item.departmentId === expense.departmentId),
    );
  }

  return warnings;
}
