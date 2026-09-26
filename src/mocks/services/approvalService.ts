import type { Expense } from "../../features/expenses/types/expense";
import { transitionExpenseState } from "../../features/expenses/domain/expenseStateMachine";
import { listRecords, listRecordsByIndex } from "./mockDataService";
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
 * authorized departments; admin: everyone).
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
    listRecords<{ id: string; organizationId: string; teamId: string; departmentId: string; roleId: string; role?: string }>("users"),
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

  return expenses.filter((expense) => {
    const owner = ownerById.get(String(expense.employeeId));
    return (
      Boolean(owner) &&
      (expense.status === "submitted" || expense.status === "under_review") &&
      getReviewDenialReason(principal, expense, owner!) === null
    );
  });
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
    throw new Error(authorization.error.message);
  }

  const status = transitionExpenseState("START_REVIEW", expense.status);
  const now = new Date().toISOString();

  const updatedExpense: Expense = {
    ...expense,
    status,
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
    throw new Error(authorization.error.message);
  }

  const status = transitionExpenseState("APPROVE", expense.status);
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
      description: `Approved expense ${updatedExpense.title}.`,
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
    throw new Error(authorization.error.message);
  }

  const normalizedReason = reason.trim();

  if (!normalizedReason) {
    throw new Error("A rejection reason is required.");
  }

  const status = transitionExpenseState("REJECT", expense.status);
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
      metadata: { reason: normalizedReason },
      description: `Rejected expense ${updatedExpense.title}.`,
    },
    (transaction) => {
      transaction.objectStore("expenses").put(updatedExpense);
    },
  );
  return updatedExpense;
}
