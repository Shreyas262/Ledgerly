import type { Expense } from "../../features/expenses/types/expense";
import { transitionExpenseState } from "../../features/expenses/domain/expenseStateMachine";
import { listRecords, listRecordsByIndex } from "./mockDataService";
import { authorizeExpenseManager, hasEligibleTeamManager } from "./workflowAuthorization";
import { runAuditedTransaction } from "./auditService";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";

/**
 * Managers review their team's expenses except their own. Admins review
 * escalated expenses (no eligible team manager) and their own expenses.
 */
export async function getApprovalQueue(
  principal: AuthenticatedPrincipal,
): Promise<Expense[]> {
  if (
    (principal.role !== "manager" && principal.role !== "admin") ||
    !principal.effectivePermissions.includes("expenses.approve")
  ) {
    return [];
  }

  const expenses =
    principal.role === "admin"
      ? await listRecordsByIndex<Expense>("expenses", "organizationId", principal.organizationId)
      : await listRecordsByIndex<Expense>("expenses", "teamId", principal.teamId);
  const users = await listRecords<{
    id: string;
    organizationId: string;
    teamId: string;
  }>("users");

  const ownerById = new Map(users.map((user) => [String(user.id), user]));
  const reviewable = expenses.filter((expense) => {
    const owner = ownerById.get(String(expense.employeeId));

    return (
      expense.organizationId === principal.organizationId &&
      (expense.status === "submitted" || expense.status === "under_review") &&
      owner?.organizationId === principal.organizationId &&
      owner.teamId === expense.teamId
    );
  });

  if (principal.role === "manager") {
    return reviewable.filter(
      (expense) =>
        expense.teamId === principal.teamId &&
        expense.employeeId !== principal.userId,
    );
  }

  const escalated = await Promise.all(
    reviewable.map(async (expense) =>
      expense.employeeId === principal.userId ||
      !(await hasEligibleTeamManager(expense.organizationId, expense.teamId, expense.employeeId)),
    ),
  );

  return reviewable.filter((_expense, index) => escalated[index]);
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
