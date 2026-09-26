import type { Expense } from "../../features/expenses/types/expense";
import { transitionExpenseState } from "../../features/expenses/domain/expenseStateMachine";
import { listRecords, listRecordsByIndex } from "./mockDataService";
import { authorizeExpenseFinance } from "./workflowAuthorization";
import { runAuditedTransaction } from "./auditService";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";

export async function getReimbursementQueue(
  principal: AuthenticatedPrincipal,
): Promise<Expense[]> {
  if (
    (principal.role !== "finance" && principal.role !== "admin") ||
    !principal.effectivePermissions.includes("reimbursements.manage")
  ) {
    return [];
  }

  const isAdmin = principal.role === "admin";
  const expenses = isAdmin
    ? await listRecordsByIndex<Expense>("expenses", "organizationId", principal.organizationId)
    : (
        await Promise.all(
          principal.authorizedDepartmentIds.map((departmentId) =>
            listRecordsByIndex<Expense>("expenses", "departmentId", departmentId),
          ),
        )
      ).flat();

  // Expenses submitted by Finance users are processed by an administrator.
  const financeOwnerIds = new Set<string>();
  if (!isAdmin) {
    const [users, roles] = await Promise.all([
      listRecords<{ id: string; roleId: string; role?: string }>("users"),
      listRecords<{ id: string; name: string }>("roles"),
    ]);
    const roleNameById = new Map(roles.map((role) => [role.id, String(role.name).toLowerCase()]));
    for (const user of users) {
      if ((roleNameById.get(user.roleId) ?? String(user.role ?? "").toLowerCase()) === "finance") {
        financeOwnerIds.add(user.id);
      }
    }
  }

  // Active financial work plus its history. Cancelled expenses are included
  // only when they were cancelled during financial processing, not drafts
  // cancelled by their owner.
  return expenses.filter(
    (expense) =>
      expense.organizationId === principal.organizationId &&
      !financeOwnerIds.has(expense.employeeId) &&
      (isAdmin || principal.authorizedDepartmentIds.includes(expense.departmentId)) &&
      (expense.status === "approved" ||
        expense.status === "reimbursement_pending" ||
        expense.status === "reimbursed" ||
        (expense.status === "cancelled" &&
          expense.reimbursement?.status === "CANCELLED")),
  );
}

export async function startReimbursement(
  principal: AuthenticatedPrincipal,
  expense: Expense,
): Promise<Expense> {
  const authorization = await authorizeExpenseFinance(principal, expense);

  if (authorization.allowed === false) {
    throw new Error(authorization.error.message);
  }

  const status = transitionExpenseState(
    "START_REIMBURSEMENT",
    expense.status,
  );
  const now = new Date().toISOString();

  const updatedExpense: Expense = {
    ...expense,
    status,
    reimbursement: {
      ...(expense.reimbursement ?? {}),
      status: "PROCESSING",
      amount: expense.reimbursement?.amount ?? expense.amount,
      processedBy: principal.userId,
    },
    updatedAt: now,
  };

  await runAuditedTransaction(
    ["expenses"],
    {
      organizationId: updatedExpense.organizationId,
      actorId: principal.userId,
      action: "REIMBURSEMENT_STARTED",
      entityType: "REIMBURSEMENT",
      entityId: updatedExpense.id,
      previousState: expense.status,
      newState: updatedExpense.status,
      metadata: { amount: updatedExpense.reimbursement?.amount },
      description: `Started reimbursement for expense ${updatedExpense.title}.`,
    },
    (transaction) => {
      transaction.objectStore("expenses").put(updatedExpense);
    },
  );
  return updatedExpense;
}

export async function reimburseExpense(
  principal: AuthenticatedPrincipal,
  expense: Expense,
): Promise<Expense> {
  const authorization = await authorizeExpenseFinance(principal, expense);

  if (authorization.allowed === false) {
    throw new Error(authorization.error.message);
  }

  const status = transitionExpenseState("REIMBURSE", expense.status);
  const now = new Date().toISOString();

  const updatedExpense: Expense = {
    ...expense,
    status,
    reimbursement: {
      ...(expense.reimbursement ?? {}),
      status: "REIMBURSED",
      amount: expense.reimbursement?.amount ?? expense.amount,
      processedAt: now,
      processedBy: principal.userId,
    },
    updatedAt: now,
  };

  await runAuditedTransaction(
    ["expenses"],
    {
      organizationId: updatedExpense.organizationId,
      actorId: principal.userId,
      action: "REIMBURSEMENT_COMPLETED",
      entityType: "REIMBURSEMENT",
      entityId: updatedExpense.id,
      previousState: expense.status,
      newState: updatedExpense.status,
      metadata: { amount: updatedExpense.reimbursement?.amount },
      description: `Completed reimbursement for expense ${updatedExpense.title}.`,
    },
    (transaction) => {
      transaction.objectStore("expenses").put(updatedExpense);
    },
  );
  return updatedExpense;
}

export async function cancelFinancialExpense(
  principal: AuthenticatedPrincipal,
  expense: Expense,
  reason: string,
): Promise<Expense> {
  const authorization = await authorizeExpenseFinance(principal, expense);

  if (authorization.allowed === false) {
    throw new Error(authorization.error.message);
  }

  const status = transitionExpenseState("CANCEL", expense.status);
  const cancellationReason = reason.trim();

  if (!cancellationReason) {
    throw new Error("A cancellation reason is required.");
  }
  const now = new Date().toISOString();

  const updatedExpense: Expense = {
    ...expense,
    status,
    reimbursement: {
      ...(expense.reimbursement ?? {}),
      status: "CANCELLED",
      processedBy: principal.userId,
    },
    cancelledAt: now,
    cancelledBy: principal.userId,
    cancellationReason,
    updatedAt: now,
  };

  await runAuditedTransaction(
    ["expenses"],
    {
      organizationId: updatedExpense.organizationId,
      actorId: principal.userId,
      action: "EXPENSE_CANCELLED",
      entityType: "EXPENSE",
      entityId: updatedExpense.id,
      previousState: expense.status,
      newState: updatedExpense.status,
      metadata: {
        reimbursementStatus: updatedExpense.reimbursement?.status,
        reason: cancellationReason,
        departmentId: expense.departmentId,
      },
      description: `Cancelled expense ${updatedExpense.title}.`,
    },
    (transaction) => {
      transaction.objectStore("expenses").put(updatedExpense);
    },
  );
  return updatedExpense;
}
