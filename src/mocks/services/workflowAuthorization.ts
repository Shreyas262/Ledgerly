import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type { Permission } from "../../features/roles/types/role";
import type { Expense } from "../../features/expenses/types/expense";
import { getRecord, listRecords, listRecordsByIndex } from "./mockDataService";
import { getActiveDelegators } from "./delegationService";
import { formatCurrency } from "../../utils/currency";

export interface WorkflowAuthorizationFailure {
  status: 403;
  code: "FORBIDDEN";
  message: string;
}

/** The person a delegate acts for (§22.12). */
export interface OnBehalfOf {
  id: string;
  name: string;
}

export type WorkflowAuthorizationResult =
  | { allowed: true; principal: AuthenticatedPrincipal; onBehalfOf?: OnBehalfOf }
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

export interface ReviewContext {
  /** An active administrator other than the expense owner exists in the organization. */
  otherAdminAvailable: boolean;
}

/**
 * Whether the organization has an active administrator other than the given
 * user, who can review or reimburse that user's expenses.
 */
export async function hasOtherActiveAdmin(organizationId: string, userId: string): Promise<boolean> {
  const [users, roles] = await Promise.all([
    listRecordsByIndex<{ id: string; roleId: string; role?: string; status?: string }>("users", "organizationId", organizationId),
    listRecords<{ id: string; name: string }>("roles"),
  ]);
  const roleNameById = new Map(roles.map((role) => [role.id, String(role.name).toLowerCase()]));
  return users.some(
    (user) =>
      user.id !== userId &&
      user.status === "active" &&
      (roleNameById.get(user.roleId) ?? String(user.role ?? "").toLowerCase()) === "admin",
  );
}

/** Whether the user is an administrator and no other active administrator exists. */
export async function isOnlyAdministrator(userId: string): Promise<boolean> {
  const owner = await resolveExpenseOwner(userId);
  return owner?.roleName === "admin" && !(await hasOtherActiveAdmin(owner.organizationId, owner.id));
}

/**
 * Approval matrix:
 * - Manager: expenses of members of their own team, except managers and Finance.
 * - Finance: expenses of managers within their authorized departments, and an
 *   administrator's expenses in those departments when no other administrator
 *   exists.
 * - Admin: any other user's expense in the organization, and the only reviewer
 *   of expenses submitted by Finance users.
 * Nobody reviews their own expense.
 * Policy escalation (§22.3): an expense submitted above its policy's approval
 * threshold routes one level up — team members' expenses to Finance for the
 * department (or Admin), managers' expenses to Admin.
 * Returns a denial reason, or null when the principal may review.
 */
export function getReviewDenialReason(
  principal: AuthenticatedPrincipal,
  expense: Pick<Expense, "organizationId" | "employeeId" | "teamId" | "departmentId" | "policyEvaluation">,
  owner: ExpenseOwner,
  context: ReviewContext,
): string | null {
  const escalated = expense.policyEvaluation?.details.escalated === true;
  const threshold = expense.policyEvaluation?.details.approvalThreshold;
  const aboveThreshold = `It is above the ${threshold !== undefined ? `${formatCurrency(threshold)} ` : ""}policy approval threshold`;

  if (expense.organizationId !== principal.organizationId || owner.organizationId !== principal.organizationId) {
    return "The expense is outside your organization.";
  }

  if (expense.employeeId === principal.userId) {
    return "You cannot review your own expense.";
  }

  // An administrator's expense is reviewed by another administrator or, when
  // they are the only one, by Finance authorized for the expense department.
  if (owner.roleName === "admin") {
    if (principal.role === "admin") return null;
    if (principal.role === "finance" && !context.otherAdminAvailable) {
      return principal.authorizedDepartmentIds.includes(expense.departmentId)
        ? null
        : "You are not authorized to review expenses from this department.";
    }
    return context.otherAdminAvailable
      ? "Expenses submitted by administrators are reviewed by another administrator."
      : "Expenses submitted by the only administrator are reviewed by Finance for their department.";
  }

  // Admin may review any other expense, including those of users who have
  // since moved teams.
  if (principal.role === "admin") {
    return null;
  }

  if (owner.teamId !== expense.teamId) {
    return "The owner has moved teams since submitting; an administrator must review this expense.";
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
    if (owner.roleName !== "manager" && !escalated) {
      return "Finance reviews expenses submitted by managers, and expenses above a policy approval threshold.";
    }
    return principal.authorizedDepartmentIds.includes(expense.departmentId)
      ? null
      : "You are not authorized to review expenses from this department.";
  }

  return "You are not authorized to review expenses.";
}

export type ReviewAuthority =
  | { allowed: true; onBehalfOf?: OnBehalfOf }
  | { allowed: false; reason: string };

/**
 * Whether the principal may review the expense (§22.3, §22.12): in their own
 * right per the approval matrix, or else on behalf of someone whose review
 * authority they hold today through a delegation. Own authority comes first,
 * the principal's own expense is never reviewable, and only the delegator's
 * own position in the matrix counts, so delegations never chain.
 */
export async function resolveReviewAuthority(
  principal: AuthenticatedPrincipal,
  expense: Pick<Expense, "organizationId" | "employeeId" | "teamId" | "departmentId" | "policyEvaluation">,
): Promise<ReviewAuthority> {
  const owner = await resolveExpenseOwner(String(expense.employeeId));
  if (!owner) {
    return { allowed: false, reason: "The person who submitted this expense could not be found." };
  }

  const context = {
    otherAdminAvailable: owner.roleName === "admin" && (await hasOtherActiveAdmin(owner.organizationId, owner.id)),
  };
  const denial = getReviewDenialReason(principal, expense, owner, context);
  if (!denial) return { allowed: true };
  if (expense.employeeId === principal.userId) return { allowed: false, reason: denial };

  for (const { delegator, name } of await getActiveDelegators(principal)) {
    if (getReviewDenialReason(delegator, expense, owner, context) === null) {
      return { allowed: true, onBehalfOf: { id: delegator.userId, name } };
    }
  }
  return { allowed: false, reason: denial };
}

export async function authorizeExpenseManager(
  principal: AuthenticatedPrincipal,
  expense: Expense,
  permission: "expenses.approve" | "expenses.reject",
): Promise<WorkflowAuthorizationResult> {
  if (!hasPermission(principal, permission)) {
    return forbidden("You are not authorized to perform this approval operation.");
  }

  const authority = await resolveReviewAuthority(principal, expense);
  if (authority.allowed === false) return forbidden(authority.reason);
  return { allowed: true, principal, ...(authority.onBehalfOf ? { onBehalfOf: authority.onBehalfOf } : {}) };
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

  // Nobody processes the reimbursement of their own expense.
  if (expense.employeeId === principal.userId) {
    return forbidden("You cannot process your own expense, so another authorized user must handle it.");
  }

  // Separation of duties: a Finance user who approved an expense, or for
  // whom a delegate approved it, cannot also process its reimbursement,
  // except an expense of the only administrator, which Finance approves in
  // place of another administrator.
  const approvedBySelf = expense.approvedBy === principal.userId;
  const approvedOnBehalf = expense.approvedOnBehalfOf === principal.userId;
  if (
    principal.role === "finance" &&
    (approvedBySelf || approvedOnBehalf) &&
    !(await isOnlyAdministrator(String(expense.employeeId)))
  ) {
    return forbidden(approvedBySelf
      ? "You approved this expense, so another authorized user must process its reimbursement."
      : "This expense was approved on your behalf, so another authorized user must process its reimbursement.");
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
