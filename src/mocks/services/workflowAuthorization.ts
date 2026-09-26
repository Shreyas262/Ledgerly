import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type { Permission } from "../../features/roles/types/role";
import type { Expense } from "../../features/expenses/types/expense";
import { getRecord } from "./mockDataService";

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

export interface ExpenseOwner {
  id: string;
  organizationId: string;
  teamId: string;
  departmentId: string;
  roleName: string;
}

/** Resolves the expense owner with the role name taken from the role record. */
export async function resolveExpenseOwner(ownerId: string): Promise<ExpenseOwner | null> {
  const user = await getRecord<{
    id: string;
    organizationId: string;
    teamId: string;
    departmentId: string;
    roleId: string;
    role?: string;
  }>("users", ownerId);
  if (!user) return null;

  const role = await getRecord<{ name: string }>("roles", user.roleId);
  return {
    id: user.id,
    organizationId: user.organizationId,
    teamId: user.teamId,
    departmentId: user.departmentId,
    roleName: String(role?.name ?? user.role ?? "").toLowerCase(),
  };
}

/**
 * Approval matrix:
 * - Manager: expenses of members of their own team, except managers and Finance.
 * - Finance: expenses of managers within their authorized departments.
 * - Admin: any expense in the organization, including their own (§35.2), and
 *   the only reviewer of expenses submitted by Finance users.
 * Nobody except Admin reviews their own expense.
 * Policy escalation (§22.3): an expense submitted above its policy's approval
 * threshold routes one level up — team members' expenses to Finance for the
 * department (or Admin), managers' expenses to Admin.
 * Returns a denial reason, or null when the principal may review.
 */
export function getReviewDenialReason(
  principal: AuthenticatedPrincipal,
  expense: Pick<Expense, "organizationId" | "employeeId" | "teamId" | "departmentId" | "policyEvaluation">,
  owner: ExpenseOwner,
): string | null {
  const escalated = expense.policyEvaluation?.details.escalated === true;
  const threshold = expense.policyEvaluation?.details.approvalThreshold;
  const aboveThreshold = `It is above the ${threshold !== undefined ? `₹${threshold.toLocaleString("en-IN")} ` : ""}policy approval threshold`;

  if (expense.organizationId !== principal.organizationId || owner.organizationId !== principal.organizationId) {
    return "The expense is outside your organization.";
  }

  // Admin may review any expense, including those of users who have since
  // moved teams.
  if (principal.role === "admin") {
    return null;
  }

  if (owner.teamId !== expense.teamId) {
    return "The owner has moved teams since submitting; an administrator must review this expense.";
  }

  if (expense.employeeId === principal.userId) {
    return "You cannot review your own expense.";
  }

  if (owner.roleName === "finance") {
    return "Expenses submitted by Finance users are reviewed by an administrator.";
  }

  if (principal.role === "manager") {
    if (owner.roleName === "manager") {
      return "Expenses submitted by managers are reviewed by Finance.";
    }
    if (escalated) {
      return `${aboveThreshold}, so Finance or an administrator must review it.`;
    }
    return owner.teamId === principal.teamId
      ? null
      : "You are not the authorized manager for this expense team.";
  }

  if (principal.role === "finance") {
    if (owner.roleName === "manager" && escalated) {
      return `${aboveThreshold}, so an administrator must review it.`;
    }
    // Finance reviews managers' expenses, and team members' expenses escalated by policy.
    const memberEscalated = escalated && owner.roleName !== "admin";
    if (owner.roleName !== "manager" && !memberEscalated) {
      return "Finance reviews expenses submitted by managers, and expenses above a policy approval threshold.";
    }
    return principal.authorizedDepartmentIds.includes(expense.departmentId)
      ? null
      : "You are not authorized to review expenses from this department.";
  }

  return "You are not authorized to review expenses.";
}

export async function authorizeExpenseManager(
  principal: AuthenticatedPrincipal,
  expense: Expense,
  permission: "expenses.approve" | "expenses.reject",
): Promise<WorkflowAuthorizationResult> {
  if (!hasPermission(principal, permission)) {
    return forbidden("You are not authorized to perform this approval operation.");
  }

  const owner = await resolveExpenseOwner(String(expense.employeeId));
  if (!owner) {
    return forbidden("The expense owner could not be resolved.");
  }

  const denial = getReviewDenialReason(principal, expense, owner);
  return denial ? forbidden(denial) : { allowed: true, principal };
}

/**
 * Reimbursement authority is independent from approval authority. Finance is
 * constrained to its authorized departments (§22.7); Admin holds
 * organization-wide authority over expense operations (§27.1, §35.2).
 */
export async function authorizeExpenseFinance(
  principal: AuthenticatedPrincipal,
  expense: Expense,
): Promise<WorkflowAuthorizationResult> {
  if (expense.organizationId !== principal.organizationId) {
    return forbidden("The expense is outside your organization.");
  }

  if (principal.role !== "finance" && principal.role !== "admin") {
    return forbidden("Only authorized Finance users or administrators may process reimbursements.");
  }

  if (!hasPermission(principal, "reimbursements.manage")) {
    return forbidden("You are not authorized to process reimbursements.");
  }

  // Separation of duties: a Finance user who approved an expense cannot
  // also process its reimbursement.
  if (principal.role === "finance" && expense.approvedBy === principal.userId) {
    return forbidden("You approved this expense, so another authorized user must process its reimbursement.");
  }

  if (
    principal.role === "finance" &&
    !principal.authorizedDepartmentIds.includes(expense.departmentId)
  ) {
    return forbidden("You are not authorized to process expenses from this department.");
  }

  // Expenses submitted by Finance users are reimbursed by an administrator.
  if (principal.role === "finance") {
    const owner = await resolveExpenseOwner(String(expense.employeeId));
    if (!owner || owner.roleName === "finance") {
      return forbidden("Expenses submitted by Finance users are reimbursed by an administrator.");
    }
  }

  return { allowed: true, principal };
}
