import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type { Expense } from "../../features/expenses/types/expense";
import { isWithinScope, resolveExpenseReadScope } from "./authorizationService";
import { resolveReviewAuthority } from "./workflowAuthorization";

interface ReadableExpense {
  organizationId: string;
  employeeId: string;
  teamId: string;
  departmentId: string;
  status: string;
  policyEvaluation?: Expense["policyEvaluation"];
  reviewStartedBy?: string;
  reviewedBy?: string;
}

const inReview = (expense: { status: string }) =>
  expense.status === "submitted" || expense.status === "under_review";

/**
 * §12.2: why the principal may not open the expense — its details, documents
 * and comments — or null when they may. Draft privacy is checked by the
 * caller first. Beyond their role scope, a user may open a non-draft expense
 * whose review they started, approved or rejected, and one in their review
 * queue through a delegation in effect (§22.12).
 */
export async function getExpenseReadDenial(
  principal: AuthenticatedPrincipal,
  expense: ReadableExpense,
): Promise<string | null> {
  if (expense.organizationId !== principal.organizationId) {
    return "This record belongs to another organization.";
  }

  const resource = {
    organizationId: expense.organizationId,
    ownerId: expense.employeeId,
    teamId: expense.teamId,
    departmentId: expense.departmentId,
  };
  if (isWithinScope(principal, resource, resolveExpenseReadScope(principal, expense))) return null;
  if (expense.status === "draft") return "You do not have access to records outside your assigned scope.";

  // A reviewer keeps sight of the decisions they made.
  if (expense.reviewStartedBy === principal.userId || expense.reviewedBy === principal.userId) return null;

  if (inReview(expense) && (await resolveReviewAuthority(principal, expense)).allowed) return null;
  return "You do not have access to records outside your assigned scope.";
}

/**
 * Adds whose delegated authority the principal would review the expense
 * under, when they may review it only through a delegation (§22.12).
 */
export async function withActingOnBehalfOf<T extends Expense>(principal: AuthenticatedPrincipal, expense: T): Promise<T> {
  if (!inReview(expense) || !principal.effectivePermissions.includes("expenses.approve")) return expense;
  const authority = await resolveReviewAuthority(principal, expense);
  return authority.allowed && authority.onBehalfOf
    ? { ...expense, actingOnBehalfOfId: authority.onBehalfOf.id, actingOnBehalfOfName: authority.onBehalfOf.name }
    : expense;
}
