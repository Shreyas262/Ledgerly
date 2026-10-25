import type { Expense, ExpenseType } from "../../features/expenses/types/expense";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type {
  BudgetForecast,
  BudgetScopeForecast,
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
import { WorkflowError, workflowForbidden } from "./workflowErrors";
import { buildTrend, forecastBudget, trendGrouping } from "./budgetForecast";
import { formatCurrency } from "../../utils/currency";
import { formatDate, toDateOnly } from "../../utils/format";

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

function utilization(amount: number, spentAmount: number, committedAmount: number): BudgetUtilization {
  return {
    spentAmount,
    remainingAmount: Math.max(amount - spentAmount, 0),
    utilizationPercent: amount > 0 ? (spentAmount / amount) * 100 : 0,
    committedAmount,
  };
}

/** Approved expenses awaiting reimbursement: committed, not yet spent (§28.8). */
const COMMITTED_STATUSES = new Set<Expense["status"]>(["approved", "reimbursement_pending"]);

/** Expenses dated in the budget period that are reimbursed (spent) or approved and unpaid (committed). */
async function countedExpensesInPeriod(budget: OrganizationBudget): Promise<{ spent: Expense[]; committed: Expense[] }> {
  const expenses = (await listRecordsByIndex<Expense>("expenses", "organizationId", budget.organizationId)).filter(
    (expense) => expense.expenseDate >= budget.startDate && expense.expenseDate <= budget.endDate,
  );
  return {
    spent: expenses.filter((expense) => expense.status === "reimbursed"),
    committed: expenses.filter((expense) => COMMITTED_STATUSES.has(expense.status)),
  };
}

async function reimbursedExpensesInPeriod(budget: OrganizationBudget): Promise<Expense[]> {
  return (await countedExpensesInPeriod(budget)).spent;
}

function sumWhere(expenses: Expense[], predicate: (expense: Expense) => boolean): number {
  return expenses.reduce((total, expense) => (predicate(expense) ? total + expense.amount : total), 0);
}

/**
 * Reimbursed spend already counted against an allocation (§28.8): a team's,
 * or a department's when no team is given, optionally for one expense type.
 * An allocation cannot be lowered below it.
 */
export async function getAllocationSpend(
  budget: OrganizationBudget,
  scope: { departmentId: string; teamId?: string; expenseType?: ExpenseType },
): Promise<number> {
  return sumWhere(await reimbursedExpensesInPeriod(budget), (expense) =>
    (scope.teamId ? expense.teamId === scope.teamId : expense.departmentId === scope.departmentId) &&
    (!scope.expenseType || expense.type === scope.expenseType));
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

/**
 * Builds the budget view, limited to what the principal may see. Every
 * level carries its reimbursed and committed spend and, while the budget is
 * active and today is within its period, a forecast (§28.19).
 */
export async function buildBudgetView(
  budget: OrganizationBudget,
  principal: AuthenticatedPrincipal,
): Promise<OrganizationBudgetView> {
  const scope = resolveBudgetScope(principal) ?? "TEAM";
  const [hierarchy, counted] = await Promise.all([loadBudgetHierarchy(), countedExpensesInPeriod(budget)]);
  const nameOf = (items: NamedRecord[], id: string) => items.find((item) => item.id === id)?.name ?? id;
  const today = todayDate();
  const forecasting = budget.status === "active" && budget.startDate <= today && today <= budget.endDate;

  /** Utilization and forecast of a level whose spend is the expenses matching it. */
  const level = (amount: number, matches: (expense: Expense) => boolean) => {
    const spentAmount = sumWhere(counted.spent, matches);
    const committedAmount = sumWhere(counted.committed, matches);
    return {
      utilization: utilization(amount, spentAmount, committedAmount),
      forecast: forecasting
        ? forecastBudget({ allocated: amount, spent: spentAmount, committed: committedAmount, startDate: budget.startDate, endDate: budget.endDate, today })
        : null,
    };
  };

  const typeView = (typeBudget: ExpenseTypeBudget) => ({
    ...typeBudget,
    ...level(typeBudget.amount, (expense) =>
      (typeBudget.teamId ? expense.teamId === typeBudget.teamId : expense.departmentId === typeBudget.departmentId) &&
      expense.type === typeBudget.expenseType),
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
          ...level(team.amount, (expense) => expense.teamId === team.teamId),
          expenseTypeBudgets: hierarchy.expenseTypeBudgets
            .filter((typeBudget) => typeBudget.teamAllocationId === team.id)
            .map(typeView),
        }));

      return {
        ...allocation,
        departmentName: nameOf(hierarchy.departments, allocation.departmentId),
        ...level(allocation.amount, (expense) => expense.departmentId === allocation.departmentId),
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

  // The viewer's own level: the organization budget, their departments
  // together, or their team, with its running totals for the forecast chart.
  const scopeLevel =
    scope === "ORGANIZATION"
      ? { allocated: budget.amount, matches: () => true }
      : scope === "DEPARTMENT"
        ? {
            allocated: departmentAllocations.reduce((sum, allocation) => sum + allocation.amount, 0),
            matches: (expense: Expense) => departmentAllocations.some((allocation) => allocation.departmentId === expense.departmentId),
          }
        : {
            allocated: departmentAllocations.flatMap((allocation) => allocation.teamAllocations).reduce((sum, team) => sum + team.amount, 0),
            matches: (expense: Expense) => expense.teamId === principal.teamId,
          };
  const scopeTotals = level(scopeLevel.allocated, scopeLevel.matches);
  const scopeForecast: BudgetScopeForecast | null =
    scopeTotals.forecast && scopeLevel.allocated > 0
      ? {
          allocated: scopeLevel.allocated,
          spentAmount: scopeTotals.utilization.spentAmount,
          committedAmount: scopeTotals.utilization.committedAmount ?? 0,
          forecast: scopeTotals.forecast,
          grouping: trendGrouping(budget.startDate, budget.endDate),
          trend: buildTrend(
            counted.spent.filter(scopeLevel.matches),
            counted.committed.filter(scopeLevel.matches),
            budget.startDate,
            budget.endDate,
            today,
          ),
        }
      : null;

  return {
    ...budget,
    viewScope: scope,
    ...level(budget.amount, () => true),
    scopeForecast,
    departmentAllocations,
  };
}

/** One level of an active budget as the viewer sees it (§25.1, §28.19). */
export interface ViewerBudgetLevel {
  budgetId: string;
  /** "Engineering department", "Engineering team" or the budget's name. */
  name: string;
  /** For sentences: "The Engineering department budget" or 'The organization budget "FY 2026"'. */
  sentenceName: string;
  /** Stable key of the level within the budget. */
  levelId: string;
  utilizationPercent: number;
  forecast: BudgetForecast | null;
}

/**
 * The levels of active budgets at the principal's level (§28.5): the
 * organization budget for Admin, department allocations for Finance and the
 * team allocation for a manager. Used by the dashboard's budget alerts and
 * the budget notices.
 */
export async function listViewerBudgetLevels(principal: AuthenticatedPrincipal): Promise<ViewerBudgetLevel[]> {
  const scope = resolveBudgetScope(principal);
  if (!scope || !principal.effectivePermissions.includes("budgets.read")) return [];
  const budgets = (await listRecordsByIndex<OrganizationBudget>("budgets", "organizationId", principal.organizationId))
    .filter((budget) => budget.status === "active");

  const levels: ViewerBudgetLevel[] = [];
  for (const budget of budgets) {
    if (!(await isBudgetVisibleTo(principal, budget))) continue;
    const view = await buildBudgetView(budget, principal);
    if (scope === "ORGANIZATION") {
      levels.push({
        budgetId: budget.id,
        name: budget.name,
        sentenceName: `The organization budget "${budget.name}"`,
        levelId: budget.id,
        utilizationPercent: view.utilization.utilizationPercent,
        forecast: view.forecast,
      });
    } else if (scope === "DEPARTMENT") {
      for (const allocation of view.departmentAllocations) {
        levels.push({
          budgetId: budget.id,
          name: `${allocation.departmentName} department`,
          sentenceName: `The ${allocation.departmentName} department budget`,
          levelId: allocation.id,
          utilizationPercent: allocation.utilization.utilizationPercent,
          forecast: allocation.forecast,
        });
      }
    } else {
      for (const team of view.departmentAllocations.flatMap((allocation) => allocation.teamAllocations)) {
        levels.push({
          budgetId: budget.id,
          name: `${team.teamName} team`,
          sentenceName: `The ${team.teamName} team budget`,
          levelId: team.id,
          utilizationPercent: team.utilization.utilizationPercent,
          forecast: team.forecast,
        });
      }
    }
  }
  return levels;
}

/** Today's date (YYYY-MM-DD). */
export function todayDate(): string {
  return toDateOnly();
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

/** Expense states that count, or will count once reimbursed, against a budget. */
const RECORDED_STATUSES = new Set<Expense["status"]>([
  "submitted",
  "under_review",
  "approved",
  "reimbursement_pending",
  "reimbursed",
]);

/**
 * §28.13: a budget that has been active keeps every expense recorded in its
 * period. Returns the reason a new period would exclude some of them, or
 * null when the period may change.
 */
export async function getPeriodChangeDenial(
  budget: OrganizationBudget,
  startDate: string,
  endDate: string,
): Promise<string | null> {
  if (budget.status === "draft") return null;

  const expenses = await listRecordsByIndex<Expense>("expenses", "organizationId", budget.organizationId);
  const recordedDates = expenses
    .filter((expense) => RECORDED_STATUSES.has(expense.status))
    .map((expense) => expense.expenseDate.slice(0, 10))
    .filter((date) => date >= budget.startDate && date <= budget.endDate);
  const excluded = recordedDates.filter((date) => date < startDate || date > endDate);
  if (excluded.length === 0) return null;

  const earliest = recordedDates.reduce((first, date) => (date < first ? date : first));
  const latest = recordedDates.reduce((last, date) => (date > last ? date : last));
  return `The period must still cover the ${recordedDates.length} expense${recordedDates.length === 1 ? "" : "s"} recorded against this budget, dated ${formatDate(earliest)} to ${formatDate(latest)}.`;
}


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
        `This expense would take ${label} over budget: ${formatCurrency(alreadySpent)} spent + ${formatCurrency(expense.amount)} exceeds ${formatCurrency(allocated)}.`,
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

/* Rules shared by the budget lifecycle and allocation services. */

/** An amount the API accepts for a budget or allocation. */
export function isPositiveAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** §28.2: an allocation that breaks the hierarchy is a business-rule failure. */
export function budgetExceeded(message: string): WorkflowError {
  return new WorkflowError(422, "BUDGET_EXCEEDED", message, { businessRule: message });
}

/**
 * §28.3–28.4: administrators change the organization and department levels;
 * Finance users and administrators the team and expense-type levels. Closed
 * budgets are not changed.
 */
export function assertCanChangeBudget(
  principal: AuthenticatedPrincipal,
  budget: OrganizationBudget,
  level: "organization" | "team",
): void {
  if (level === "organization" && principal.role !== "admin") {
    throw workflowForbidden("Only administrators can manage organization budgets and department allocations.");
  }
  if (level === "team" && principal.role !== "admin" && principal.role !== "finance") {
    throw workflowForbidden("Only Finance users and administrators manage team and expense-type budgets.");
  }
  if (budget.status === "closed") throw new WorkflowError(409, "CONFLICT", "Closed budgets cannot be changed.");
}
