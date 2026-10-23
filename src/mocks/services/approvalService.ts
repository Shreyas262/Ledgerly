import type { Expense } from "../../features/expenses/types/expense";
import { transitionOrConflict, workflowForbidden, workflowReasonRequired } from "./workflowErrors";
import { getRecord, listRecords, listRecordsByIndex } from "./mockDataService";
import {
  authorizeExpenseManager,
  getReviewDenialReason,
  type ExpenseOwner,
} from "./workflowAuthorization";
import { runAuditedTransaction } from "./auditService";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";

/**
 * Submitted expenses the principal may review, per the approval matrix in
 * getReviewDenialReason (manager: team members; finance: managers within
 * authorized departments; admin: everyone else).
 */
export async function getApprovalQueue(
  principal: AuthenticatedPrincipal,
): Promise<Expense[]> {
  if (
    !["manager", "finance", "admin"].includes(principal.role) ||
    !principal.effectivePermissions.includes("expenses.approve")
  ) {
    return [];
  }

  const expenses =
    principal.role === "admin"
      ? await listRecordsByIndex<Expense>("expenses", "organizationId", principal.organizationId)
      : principal.role === "finance"
        ? (
            await Promise.all(
              principal.authorizedDepartmentIds.map((departmentId) =>
                listRecordsByIndex<Expense>("expenses", "departmentId", departmentId),
              ),
            )
          ).flat()
        : await listRecordsByIndex<Expense>("expenses", "teamId", principal.teamId);

  const [users, roles] = await Promise.all([
    listRecords<{ id: string; organizationId: string; teamId: string; departmentId: string; roleId: string; role?: string; status?: string }>("users"),
    listRecords<{ id: string; name: string }>("roles"),
  ]);
  const roleNameById = new Map(roles.map((role) => [role.id, String(role.name).toLowerCase()]));
  const ownerById = new Map<string, ExpenseOwner>(
    users.map((user) => [
      user.id,
      {
        id: user.id,
        organizationId: user.organizationId,
        teamId: user.teamId,
        departmentId: user.departmentId,
        roleName: roleNameById.get(user.roleId) ?? String(user.role ?? "").toLowerCase(),
      },
    ]),
  );
  const activeAdminIds = users
    .filter(
      (user) =>
        user.organizationId === principal.organizationId &&
        user.status === "active" &&
        ownerById.get(user.id)?.roleName === "admin",
    )
    .map((user) => user.id);

  return expenses.filter((expense) => {
    const owner = ownerById.get(String(expense.employeeId));
    return (
      Boolean(owner) &&
      (expense.status === "submitted" || expense.status === "under_review") &&
      getReviewDenialReason(principal, expense, owner!, {
        otherAdminAvailable: activeAdminIds.some((id) => id !== owner!.id),
      }) === null
    );
  });
}

/**
 * An expense in review is approved or rejected by whoever started the review.
 * An administrator may take the review over; the reviewer they replace is
 * returned so the audit event can record it. Others are refused.
 */
async function resolveReviewTakeover(
  principal: AuthenticatedPrincipal,
  expense: Expense,
): Promise<{ id: string; name: string } | undefined> {
  const reviewerId = expense.reviewStartedBy;
  if (expense.status !== "under_review" || !reviewerId || reviewerId === principal.userId) return undefined;

  const reviewer = await getRecord<{ id: string; name: string }>("users", reviewerId);
  const name = reviewer?.name ?? "Another reviewer";
  if (principal.role !== "admin") {
    throw workflowForbidden(`${name} started this review, so only they or an administrator can approve or reject it.`);
  }
  return { id: reviewerId, name };
}

export async function startExpenseReview(
  principal: AuthenticatedPrincipal,
  expense: Expense,
): Promise<Expense> {
  const authorization = await authorizeExpenseManager(
    principal,
    expense,
    "expenses.approve",
  );

  if (authorization.allowed === false) {
    throw workflowForbidden(authorization.error.message);
  }

  const status = transitionOrConflict("START_REVIEW", expense.status);
  const now = new Date().toISOString();

  const updatedExpense: Expense = {
    ...expense,
    status,
    reviewStartedBy: principal.userId,
    reviewStartedAt: now,
    updatedAt: now,
  };

  await runAuditedTransaction(
    ["expenses"],
    {
      organizationId: updatedExpense.organizationId,
      actorId: principal.userId,
      action: "EXPENSE_REVIEWED",
      entityType: "EXPENSE",
      entityId: updatedExpense.id,
      previousState: expense.status,
      newState: updatedExpense.status,
      description: `Started review for expense ${updatedExpense.title}.`,
    },
    (transaction) => {
      transaction.objectStore("expenses").put(updatedExpense);
    },
  );
  return updatedExpense;
}

export async function approveExpense(
  principal: AuthenticatedPrincipal,
  expense: Expense,
): Promise<Expense> {
  const authorization = await authorizeExpenseManager(
    principal,
    expense,
    "expenses.approve",
  );

  if (authorization.allowed === false) {
    throw workflowForbidden(authorization.error.message);
  }

  const takenOverFrom = await resolveReviewTakeover(principal, expense);
  const status = transitionOrConflict("APPROVE", expense.status);
  const now = new Date().toISOString();

  const updatedExpense: Expense = {
    ...expense,
    status,
    reviewedBy: principal.userId,
    reviewedAt: now,
    approvedBy: principal.userId,
    updatedAt: now,
  };

  await runAuditedTransaction(
    ["expenses"],
    {
      organizationId: updatedExpense.organizationId,
      actorId: principal.userId,
      action: "EXPENSE_APPROVED",
      entityType: "EXPENSE",
      entityId: updatedExpense.id,
      previousState: expense.status,
      newState: updatedExpense.status,
      ...(takenOverFrom ? { metadata: { overriddenReviewerId: takenOverFrom.id } } : {}),
      description: takenOverFrom
        ? `Approved expense ${updatedExpense.title}, overriding the review started by ${takenOverFrom.name}.`
        : `Approved expense ${updatedExpense.title}.`,
    },
    (transaction) => {
      transaction.objectStore("expenses").put(updatedExpense);
    },
  );
  return updatedExpense;
}

export async function rejectExpense(
  principal: AuthenticatedPrincipal,
  expense: Expense,
  reason: string,
): Promise<Expense> {
  const authorization = await authorizeExpenseManager(
    principal,
    expense,
    "expenses.reject",
  );

  if (authorization.allowed === false) {
    throw workflowForbidden(authorization.error.message);
  }

  const normalizedReason = reason.trim();

  if (!normalizedReason) {
    throw workflowReasonRequired("A rejection reason is required.");
  }

  const takenOverFrom = await resolveReviewTakeover(principal, expense);
  const status = transitionOrConflict("REJECT", expense.status);
  const now = new Date().toISOString();

  const updatedExpense: Expense = {
    ...expense,
    status,
    reviewedBy: principal.userId,
    reviewedAt: now,
    rejectionReason: normalizedReason,
    updatedAt: now,
  };

  await runAuditedTransaction(
    ["expenses"],
    {
      organizationId: updatedExpense.organizationId,
      actorId: principal.userId,
      action: "EXPENSE_REJECTED",
      entityType: "EXPENSE",
      entityId: updatedExpense.id,
      previousState: expense.status,
      newState: updatedExpense.status,
      metadata: {
        reason: normalizedReason,
        ...(takenOverFrom ? { overriddenReviewerId: takenOverFrom.id } : {}),
      },
      description: takenOverFrom
        ? `Rejected expense ${updatedExpense.title}, overriding the review started by ${takenOverFrom.name}.`
        : `Rejected expense ${updatedExpense.title}.`,
    },
    (transaction) => {
      transaction.objectStore("expenses").put(updatedExpense);
    },
  );
  return updatedExpense;
}
