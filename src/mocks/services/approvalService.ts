import type { Expense } from "../../features/expenses/types/expense";
import { transitionOrConflict, workflowForbidden, workflowReasonRequired } from "./workflowErrors";
import { getRecord, listRecords, listRecordsByIndex } from "./mockDataService";
import {
  authorizeExpenseManager,
  getReviewDenialReason,
  type ExpenseOwner,
  type OnBehalfOf,
} from "./workflowAuthorization";
import { getActiveDelegators } from "./delegationService";
import { runAuditedTransaction } from "./auditService";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";

interface OwnerContext {
  ownerById: Map<string, ExpenseOwner>;
  activeAdminIds: string[];
}

async function loadOwnerContext(organizationId: string): Promise<OwnerContext> {
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
        user.organizationId === organizationId &&
        user.status === "active" &&
        ownerById.get(user.id)?.roleName === "admin",
    )
    .map((user) => user.id);
  return { ownerById, activeAdminIds };
}

/**
 * Submitted expenses the principal may review in their own right, per the
 * approval matrix in getReviewDenialReason (manager: team members; finance:
 * managers within authorized departments; admin: everyone else).
 */
async function getMatrixQueue(principal: AuthenticatedPrincipal, context: OwnerContext): Promise<Expense[]> {
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

  return expenses.filter((expense) => {
    const owner = context.ownerById.get(String(expense.employeeId));
    return (
      Boolean(owner) &&
      (expense.status === "submitted" || expense.status === "under_review") &&
      getReviewDenialReason(principal, expense, owner!, {
        otherAdminAvailable: context.activeAdminIds.some((id) => id !== owner!.id),
      }) === null
    );
  });
}

/**
 * The principal's review queue: what they may review in their own right,
 * plus what the people who delegated their reviews to them may review
 * (§22.12), marked with whom the principal would act for. Their own
 * expenses never appear.
 */
export async function getApprovalQueue(
  principal: AuthenticatedPrincipal,
): Promise<Expense[]> {
  const context = await loadOwnerContext(principal.organizationId);
  const queue = await getMatrixQueue(principal, context);
  const queued = new Set(queue.map((expense) => expense.id));

  for (const { delegator, name } of await getActiveDelegators(principal)) {
    for (const expense of await getMatrixQueue(delegator, context)) {
      if (queued.has(expense.id) || expense.employeeId === principal.userId) continue;
      queued.add(expense.id);
      queue.push({ ...expense, actingOnBehalfOfId: delegator.userId, actingOnBehalfOfName: name });
    }
  }
  return queue;
}

/**
 * An expense in review is approved or rejected by whoever started the review,
 * the person they started it on behalf of, or someone currently reviewing on
 * behalf of either (§22.4, §22.12). An administrator may take the review
 * over; the reviewer they replace is returned so the audit event can record
 * it. Others are refused.
 */
async function resolveReviewTakeover(
  principal: AuthenticatedPrincipal,
  expense: Expense,
): Promise<{ id: string; name: string } | undefined> {
  const reviewerId = expense.reviewStartedBy;
  if (expense.status !== "under_review" || !reviewerId) return undefined;

  const parties = [reviewerId, expense.reviewStartedOnBehalfOf].filter((id): id is string => Boolean(id));
  if (parties.includes(principal.userId)) return undefined;
  if ((await getActiveDelegators(principal)).some(({ delegator }) => parties.includes(delegator.userId))) return undefined;

  const reviewer = await getRecord<{ id: string; name: string }>("users", reviewerId);
  const name = reviewer?.name ?? "Another reviewer";
  if (principal.role !== "admin") {
    const onBehalfOf = expense.reviewStartedOnBehalfOf
      ? (await getRecord<{ name: string }>("users", expense.reviewStartedOnBehalfOf))?.name
      : undefined;
    throw workflowForbidden(onBehalfOf
      ? `${name} started this review on behalf of ${onBehalfOf}, so only they, ${onBehalfOf} or an administrator can approve or reject it.`
      : `${name} started this review, so only they or an administrator can approve or reject it.`);
  }
  return { id: reviewerId, name };
}

/** " on behalf of Sarah Manager" for audit descriptions, or nothing. */
const onBehalfText = (onBehalfOf?: OnBehalfOf) => (onBehalfOf ? ` on behalf of ${onBehalfOf.name}` : "");

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

  const { onBehalfOf } = authorization;
  const status = transitionOrConflict("START_REVIEW", expense.status);
  const now = new Date().toISOString();
  const { reviewStartedOnBehalfOf: _previous, ...rest } = expense;

  const updatedExpense: Expense = {
    ...rest,
    status,
    reviewStartedBy: principal.userId,
    reviewStartedAt: now,
    ...(onBehalfOf ? { reviewStartedOnBehalfOf: onBehalfOf.id } : {}),
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
      ...(onBehalfOf ? { metadata: { onBehalfOf: onBehalfOf.id } } : {}),
      description: `Started review for expense ${updatedExpense.title}${onBehalfText(onBehalfOf)}.`,
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

  const { onBehalfOf } = authorization;
  const takenOverFrom = await resolveReviewTakeover(principal, expense);
  const status = transitionOrConflict("APPROVE", expense.status);
  const now = new Date().toISOString();
  const { approvedOnBehalfOf: _previous, ...rest } = expense;

  const updatedExpense: Expense = {
    ...rest,
    status,
    reviewedBy: principal.userId,
    reviewedAt: now,
    approvedBy: principal.userId,
    ...(onBehalfOf ? { approvedOnBehalfOf: onBehalfOf.id } : {}),
    updatedAt: now,
  };

  const metadata = {
    ...(takenOverFrom ? { overriddenReviewerId: takenOverFrom.id } : {}),
    ...(onBehalfOf ? { onBehalfOf: onBehalfOf.id } : {}),
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
      ...(Object.keys(metadata).length ? { metadata } : {}),
      description: takenOverFrom
        ? `Approved expense ${updatedExpense.title}, overriding the review started by ${takenOverFrom.name}.`
        : `Approved expense ${updatedExpense.title}${onBehalfText(onBehalfOf)}.`,
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

  const { onBehalfOf } = authorization;
  const takenOverFrom = await resolveReviewTakeover(principal, expense);
  const status = transitionOrConflict("REJECT", expense.status);
  const now = new Date().toISOString();
  const { rejectedOnBehalfOf: _previous, ...rest } = expense;

  const updatedExpense: Expense = {
    ...rest,
    status,
    reviewedBy: principal.userId,
    reviewedAt: now,
    rejectionReason: normalizedReason,
    rejectedBy: principal.userId,
    rejectedAt: now,
    ...(onBehalfOf ? { rejectedOnBehalfOf: onBehalfOf.id } : {}),
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
        ...(onBehalfOf ? { onBehalfOf: onBehalfOf.id } : {}),
      },
      description: takenOverFrom
        ? `Rejected expense ${updatedExpense.title}, overriding the review started by ${takenOverFrom.name}.`
        : `Rejected expense ${updatedExpense.title}${onBehalfText(onBehalfOf)}.`,
    },
    (transaction) => {
      transaction.objectStore("expenses").put(updatedExpense);
    },
  );
  return updatedExpense;
}
