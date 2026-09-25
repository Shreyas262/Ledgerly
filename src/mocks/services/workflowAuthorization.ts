import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type { Permission } from "../../features/roles/types/role";
import type { Expense } from "../../features/expenses/types/expense";
import { getRecord, listRecordsByIndex } from "./mockDataService";

export interface WorkflowAuthorizationFailure {
  status: 403;
  code: "FORBIDDEN";
  message: string;
}

export type WorkflowAuthorizationResult =
  | { allowed: true; principal: AuthenticatedPrincipal }
  | { allowed: false; error: WorkflowAuthorizationFailure };

function forbidden(message: string): WorkflowAuthorizationResult {
  return {
    allowed: false,
    error: {
      status: 403,
      code: "FORBIDDEN",
      message,
    },
  };
}

function hasPermission(
  principal: AuthenticatedPrincipal,
  permission: Permission,
): boolean {
  return principal.effectivePermissions.includes(permission);
}

interface ApprovalUser {
  id: string;
  organizationId: string;
  teamId: string;
  roleId: string;
  role?: string;
  status?: string;
}

/**
 * Whether the owner's team has an active manager, other than the owner, who
 * holds approval authority. Without one the expense escalates to Admin.
 */
export async function hasEligibleTeamManager(
  organizationId: string,
  teamId: string,
  ownerId: string,
): Promise<boolean> {
  const members = await listRecordsByIndex<ApprovalUser>("users", "teamId", teamId);

  for (const member of members) {
    if (
      member.id === ownerId ||
      member.organizationId !== organizationId ||
      member.role !== "manager" ||
      member.status === "inactive"
    ) {
      continue;
    }

    const role = await getRecord<{ permissions: string[] }>("roles", member.roleId);
    if (role?.permissions.includes("expenses.approve")) return true;
  }

  return false;
}

/**
 * Approval authority is resolved from the expense owner's team; a manager
 * role alone does not grant it, and managers never review their own expenses.
 * Expenses without an eligible team manager (a manager's own expenses, teams
 * without a manager) escalate to Admin, who may also approve their own
 * expenses (§35.2).
 */
export async function authorizeExpenseManager(
  principal: AuthenticatedPrincipal,
  expense: Expense,
  permission: "expenses.approve" | "expenses.reject",
): Promise<WorkflowAuthorizationResult> {
  if (expense.organizationId !== principal.organizationId) {
    return forbidden("The expense is outside your organization.");
  }

  if (principal.role !== "manager" && principal.role !== "admin") {
    return forbidden("Only an authorized team manager or administrator may approve or reject expenses.");
  }

  if (!hasPermission(principal, permission)) {
    return forbidden("You are not authorized to perform this approval operation.");
  }

  const owner = await getRecord<{
    id: string;
    organizationId: string;
    teamId: string;
    departmentId: string;
  }>("users", String(expense.employeeId));

  if (!owner) {
    return forbidden("The expense owner could not be resolved.");
  }

  if (owner.organizationId !== principal.organizationId) {
    return forbidden("The expense owner is outside your organization.");
  }

  if (owner.teamId !== expense.teamId) {
    return forbidden("The expense team does not match the owner's team.");
  }

  if (principal.role === "admin") {
    if (
      expense.employeeId === principal.userId ||
      !(await hasEligibleTeamManager(owner.organizationId, owner.teamId, owner.id))
    ) {
      return { allowed: true, principal };
    }

    return forbidden("This expense is reviewed by its team manager.");
  }

  if (expense.employeeId === principal.userId) {
    return forbidden("You cannot review your own expense.");
  }

  if (owner.teamId !== principal.teamId) {
    return forbidden("You are not the authorized manager for this expense team.");
  }

  return { allowed: true, principal };
}

/**
 * Reimbursement authority is independent from approval authority and is
 * constrained to the finance user's authorized departments (§22.7).
 */
export function authorizeExpenseFinance(
  principal: AuthenticatedPrincipal,
  expense: Expense,
): WorkflowAuthorizationResult {
  if (expense.organizationId !== principal.organizationId) {
    return forbidden("The expense is outside your organization.");
  }

  if (principal.role !== "finance") {
    return forbidden("Only authorized Finance users may process reimbursements.");
  }

  if (!hasPermission(principal, "reimbursements.manage")) {
    return forbidden("You are not authorized to process reimbursements.");
  }

  if (!principal.authorizedDepartmentIds.includes(expense.departmentId)) {
    return forbidden("You are not authorized to process expenses from this department.");
  }

  return { allowed: true, principal };
}
