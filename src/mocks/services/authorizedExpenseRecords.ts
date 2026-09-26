import type { Expense } from "../../features/expenses/types/expense";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import { getRecord, listRecords, listRecordsByIndex } from "./mockDataService";
import {
  isExpenseVisibleToPrincipal,
  resolveExpenseScope,
  type AuthorizationScope,
} from "./authorizationService";

/**
 * A principal may always request their own expenses, or their full
 * authorized scope. Narrower non-own scopes are not exposed.
 */
export function isExpenseScopeAllowed(
  principal: AuthenticatedPrincipal,
  scope: AuthorizationScope,
): boolean {
  return scope === "OWN" || scope === resolveExpenseScope(principal);
}

/**
 * Retrieves only the expense scope needed by the current principal. The
 * IndexedDB query is deliberately performed before any dashboard/analytics
 * aggregation so large organizations do not require a full expense scan.
 */
export async function getAuthorizedExpenseRecords(
  principal: AuthenticatedPrincipal,
  scope: AuthorizationScope = resolveExpenseScope(principal),
): Promise<Expense[]> {
  if (!isExpenseScopeAllowed(principal, scope)) {
    return [];
  }

  let indexName: "organizationId" | "departmentId" | "teamId" | "employeeId";
  let indexValues: string[];

  switch (scope) {
    case "ORGANIZATION":
      indexName = "organizationId";
      indexValues = [principal.organizationId];
      break;
    case "DEPARTMENT":
      indexName = "departmentId";
      indexValues = principal.authorizedDepartmentIds;
      break;
    case "TEAM":
      indexName = "teamId";
      indexValues = [principal.teamId];
      break;
    default:
      indexName = "employeeId";
      indexValues = [principal.userId];
      break;
  }

  const records = (
    await Promise.all(
      indexValues.map((value) => listRecordsByIndex<Expense>("expenses", indexName, value)),
    )
  ).flat();
  return records.filter(
    (expense) =>
      expense.organizationId === principal.organizationId &&
      isExpenseVisibleToPrincipal(principal, expense),
  );
}

interface NamedExpenseFields {
  employeeId: string;
  teamId?: string;
  departmentId?: string;
  cancelledBy?: string;
  reimbursement?: { processedBy?: string };
}

/**
 * Adds display names for the owner, the reimbursement processor and the
 * canceller to expense responses so the UI never has to resolve users itself
 * (users.read is an administrative permission).
 */
export async function withEmployeeNames<T extends NamedExpenseFields>(
  expenses: T[],
): Promise<Array<T & { employeeName?: string; cancelledByName?: string; teamName?: string; departmentName?: string }>> {
  if (expenses.length === 0) return [];

  const [teams, departments] = await Promise.all([
    listRecords<{ id: string; name: string }>("teams"),
    listRecords<{ id: string; name: string }>("departments"),
  ]);
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const departmentNameById = new Map(departments.map((department) => [department.id, department.name]));

  const userIds = new Set(
    expenses.flatMap((expense) =>
      [expense.employeeId, expense.cancelledBy, expense.reimbursement?.processedBy].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );
  const users =
    userIds.size === 1
      ? [await getRecord<{ id: string; name: string }>("users", [...userIds][0])].filter(
          (user): user is { id: string; name: string } => Boolean(user),
        )
      : await listRecords<{ id: string; name: string }>("users");
  const nameById = new Map(users.map((user) => [user.id, user.name]));

  return expenses.map((expense) => {
    const employeeName = nameById.get(expense.employeeId);
    const cancelledByName = expense.cancelledBy ? nameById.get(expense.cancelledBy) : undefined;
    const processedByName = expense.reimbursement?.processedBy
      ? nameById.get(expense.reimbursement.processedBy)
      : undefined;

    const teamName = expense.teamId ? teamNameById.get(expense.teamId) : undefined;
    const departmentName = expense.departmentId ? departmentNameById.get(expense.departmentId) : undefined;

    return {
      ...expense,
      ...(employeeName ? { employeeName } : {}),
      ...(teamName ? { teamName } : {}),
      ...(departmentName ? { departmentName } : {}),
      ...(cancelledByName ? { cancelledByName } : {}),
      ...(expense.reimbursement && processedByName
        ? { reimbursement: { ...expense.reimbursement, processedByName } }
        : {}),
    };
  });
}
