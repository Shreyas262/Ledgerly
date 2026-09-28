import type { OrganizationBudgetView } from "../types/budget";

export interface BudgetViewTitle {
  /** What the viewer is looking at, e.g. "Engineering Team Budget". */
  title: string;
  /** Short label for the viewer's level, e.g. "Organization budget" or the department names. */
  scopeLabel: string;
  /** For department and team views, the organization budget this belongs to. */
  parentName?: string;
}

/**
 * §28.5: each role sees its own level of the budget — the organization budget
 * for Admin, the department budget for Finance and the team budget for a manager.
 */
export function budgetViewTitle(budget: OrganizationBudgetView): BudgetViewTitle {
  if (budget.viewScope === "ORGANIZATION") {
    return { title: budget.name, scopeLabel: "Organization budget" };
  }
  if (budget.viewScope === "DEPARTMENT") {
    const names = budget.departmentAllocations.map((department) => department.departmentName);
    return {
      title: names.length === 1 ? `${names[0]} Department Budget` : "Department Budget",
      scopeLabel: names.length ? names.join(", ") : "Your departments",
      parentName: budget.name,
    };
  }
  const teamName = budget.departmentAllocations.flatMap((department) => department.teamAllocations)[0]?.teamName;
  return {
    title: teamName ? `${teamName} Team Budget` : "Team Budget",
    scopeLabel: teamName ? `${teamName} team` : "Your team",
    parentName: budget.name,
  };
}
