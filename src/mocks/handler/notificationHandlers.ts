import { http, HttpResponse } from "msw";
import { apiError } from "../services/apiError";
import { isExpenseVisibleToPrincipal, resolveAuthenticatedPrincipal } from "../services/authorizationService";
import { getExpenseReadDenial } from "../services/expenseAccessService";
import { getStoredComments, type StoredExpenseComment } from "../services/expenseCommentService";
import { getRecord, listRecords, listRecordsByIndex } from "../services/mockDataService";
import { getApprovalQueue } from "../services/approvalService";
import { getReimbursementQueue } from "../services/reimbursementService";
import { authorizeExpenseFinance } from "../services/workflowAuthorization";
import { getExpenseCreationEligibility, todayDate } from "../services/budgetService";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type { Expense } from "../../features/expenses/types/expense";
import type { AuditEvent } from "../../features/audit/types/audit";
import type { OrganizationBudget } from "../../features/budgets/types/budget";
import type { AppNotification } from "../../features/notifications/types/notification";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/format";

const WINDOW_DAYS = 30;
const LIMIT = 40;

/** Whether the user may still open the expense, as `GET /api/expenses/:id` decides. */
async function canReadExpense(principal: AuthenticatedPrincipal, expense: Expense): Promise<boolean> {
  return (
    principal.effectivePermissions.includes("expenses.read") &&
    isExpenseVisibleToPrincipal(principal, expense) &&
    (await getExpenseReadDenial(principal, expense)) === null
  );
}

const latest = (dates: Array<string | undefined>) =>
  dates.filter((date): date is string => Boolean(date)).sort().at(-1) ?? new Date().toISOString();

export const notificationHandlers = [
  // §24.4: notifications derived from the audit log and current work queues.
  // Nothing new is stored; read state is kept by the client per user.
  http.get("/api/notifications", async ({ request }) => {
    const principal = await resolveAuthenticatedPrincipal(request);
    if (!principal) return apiError(401, "Please sign in to continue.");

    const since = Date.now() - WINDOW_DAYS * 86_400_000;
    const [ownExpenses, users, events] = await Promise.all([
      listRecordsByIndex<Expense>("expenses", "employeeId", principal.userId),
      listRecords<{ id: string; name: string }>("users"),
      listRecordsByIndex<AuditEvent>("auditEvents", "organizationId", principal.organizationId),
    ]);
    const expenseById = new Map(ownExpenses.map((expense) => [expense.id, expense]));
    const nameOf = (id: string) => users.find((user) => user.id === id)?.name ?? "A reviewer";
    const notifications: AppNotification[] = [];

    // Review delegations to the user (§22.12).
    for (const event of events) {
      if (event.entityType !== "DELEGATION" || event.metadata?.delegateId !== principal.userId || new Date(event.timestamp).getTime() < since) continue;
      const period = `${formatDate(String(event.metadata.startDate))} to ${formatDate(String(event.metadata.endDate))}`;
      const base = { id: event.id, category: "REVIEW_QUEUE" as const, link: "/approvals", timestamp: event.timestamp };
      if (event.action === "DELEGATION_CREATED") {
        notifications.push({ ...base, severity: "info", title: "Reviews delegated to you", message: `${nameOf(event.actorId)} delegated expense reviews to you from ${period}.` });
      } else if (event.action === "DELEGATION_CANCELLED") {
        notifications.push({ ...base, severity: "info", title: "Review delegation cancelled", message: `${nameOf(event.actorId)} cancelled the delegation of expense reviews to you (${period}).` });
      }
    }

    for (const event of events) {
      // Reimbursement events are recorded against the expense id.
      if ((event.entityType !== "EXPENSE" && event.entityType !== "REIMBURSEMENT") || new Date(event.timestamp).getTime() < since) continue;
      const expense = expenseById.get(event.entityId);
      if (!expense) continue;
      const base = { id: event.id, link: `/expenses/${expense.id}`, timestamp: event.timestamp };
      const byOther = event.actorId !== principal.userId;
      const label = `"${expense.title}"`;
      // "Mike Finance on behalf of Sarah Manager" for reviews by a delegate.
      const reviewer = typeof event.metadata?.onBehalfOf === "string"
        ? `${nameOf(event.actorId)} on behalf of ${nameOf(event.metadata.onBehalfOf)}`
        : nameOf(event.actorId);

      switch (event.action) {
        case "EXPENSE_REVIEWED":
          if (byOther) notifications.push({ ...base, category: "EXPENSE_UPDATES", severity: "info", title: "Review started", message: `${reviewer} started reviewing ${label}.` });
          break;
        case "EXPENSE_APPROVED":
          if (byOther) notifications.push({ ...base, category: "EXPENSE_UPDATES", severity: "success", title: "Expense approved", message: `${label} was approved by ${reviewer}.` });
          break;
        case "EXPENSE_REJECTED":
          if (byOther) notifications.push({ ...base, category: "EXPENSE_UPDATES", severity: "error", title: "Expense rejected", message: `${label} was rejected by ${reviewer}.${expense.rejectionReason ? ` Reason: ${expense.rejectionReason}` : ""}` });
          break;
        case "EXPENSE_CANCELLED":
          if (byOther) notifications.push({ ...base, category: "EXPENSE_UPDATES", severity: "warning", title: "Expense cancelled", message: `${label} was cancelled by ${nameOf(event.actorId)}.` });
          break;
        case "REIMBURSEMENT_STARTED":
          if (byOther) notifications.push({ ...base, category: "REIMBURSEMENTS", severity: "info", title: "Reimbursement started", message: `Reimbursement of ${label} (${formatCurrency(expense.amount)}) is being processed.` });
          break;
        case "REIMBURSEMENT_COMPLETED":
          if (byOther) notifications.push({ ...base, category: "REIMBURSEMENTS", severity: "success", title: "Expense reimbursed", message: `${formatCurrency(expense.amount)} for ${label} has been reimbursed.` });
          break;
        case "EXPENSE_SUBMITTED": {
          const details = expense.policyEvaluation?.details;
          const warnings = details?.warnings?.length ?? 0;
          if (!byOther && (warnings || details?.escalated)) {
            const parts = [
              warnings ? `${warnings} policy ${warnings === 1 ? "warning" : "warnings"}` : "",
              details?.escalated ? "it is above the approval threshold, so Finance or an administrator will review it" : "",
            ].filter(Boolean);
            notifications.push({ ...base, category: "POLICY_ALERTS", severity: "warning", title: "Policy notice", message: `${label} was submitted with ${parts.join("; ")}.` });
          }
          break;
        }
      }
    }

    // Comments by others on expenses the user owns, is reviewing or has commented on (§29.10).
    const threads = new Map<string, StoredExpenseComment[]>();
    for (const event of events) {
      if (event.action !== "EXPENSE_COMMENTED" || event.actorId === principal.userId || new Date(event.timestamp).getTime() < since) continue;
      const expense = expenseById.get(event.entityId) ?? (await getRecord<Expense>("expenses", event.entityId));
      if (!expense || !(await canReadExpense(principal, expense))) continue;
      if (!threads.has(expense.id)) threads.set(expense.id, await getStoredComments(expense.id));
      const thread = threads.get(expense.id) ?? [];
      const involved =
        expense.employeeId === principal.userId ||
        expense.reviewStartedBy === principal.userId ||
        expense.reviewedBy === principal.userId ||
        thread.some((comment) => comment.authorId === principal.userId && comment.createdAt < event.timestamp);
      const comment = thread.find((item) => item.id === event.metadata?.commentId);
      if (!involved || !comment) continue;
      const excerpt = comment.body.length > 80 ? `${comment.body.slice(0, 80).trimEnd()}…` : comment.body;
      notifications.push({
        id: event.id,
        category: "COMMENTS",
        severity: "info",
        title: "New comment",
        message: `${nameOf(event.actorId)} commented on "${expense.title}": "${excerpt}"`,
        link: `/expenses/${expense.id}`,
        timestamp: event.timestamp,
      });
    }

    // Work waiting for the user.
    const reviewQueue = await getApprovalQueue(principal);
    if (reviewQueue.length) {
      const waiting = reviewQueue.filter((expense) => expense.status === "submitted");
      const delegated = reviewQueue.filter((expense) => expense.actingOnBehalfOfId).length;
      const details = [
        waiting.length ? `${waiting.length} not yet started` : "",
        delegated ? `${delegated} on behalf of others` : "",
      ].filter(Boolean);
      notifications.push({
        id: "queue-review",
        category: "REVIEW_QUEUE",
        severity: "info",
        title: "Expenses awaiting review",
        message: `${reviewQueue.length} ${reviewQueue.length === 1 ? "expense is" : "expenses are"} in your review queue${details.length ? `, ${details.join(" and ")}` : ""}.`,
        link: "/approvals",
        timestamp: latest(reviewQueue.map((expense) => expense.submittedAt ?? expense.updatedAt)),
      });
    }
    const toReimburse: Expense[] = [];
    for (const expense of await getReimbursementQueue(principal)) {
      if (expense.status !== "approved") continue;
      if ((await authorizeExpenseFinance(principal, expense)).allowed) toReimburse.push(expense);
    }
    if (toReimburse.length) {
      notifications.push({
        id: "queue-reimbursement",
        category: "REVIEW_QUEUE",
        severity: "info",
        title: "Expenses awaiting reimbursement",
        message: `${toReimburse.length} approved ${toReimburse.length === 1 ? "expense is" : "expenses are"} ready for you to reimburse.`,
        link: "/approvals",
        timestamp: latest(toReimburse.map((expense) => expense.updatedAt)),
      });
    }

    // Budget conditions that affect the user.
    if (principal.effectivePermissions.includes("expenses.create")) {
      const eligibility = await getExpenseCreationEligibility(principal);
      if (!eligibility.allowed && eligibility.reason) {
        notifications.push({ id: `budget-${eligibility.code}`, category: "BUDGET_ALERTS", severity: "warning", title: "Expenses cannot be created", message: eligibility.reason, link: "/expenses", timestamp: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() });
      }
    }
    if (principal.role === "admin") {
      const today = todayDate();
      for (const budget of await listRecords<OrganizationBudget>("budgets")) {
        if (budget.organizationId !== principal.organizationId || budget.status !== "active" || budget.endDate >= today) continue;
        notifications.push({
          id: `budget-ended-${budget.id}`,
          category: "BUDGET_ALERTS",
          severity: "warning",
          title: "Budget period ended",
          message: `"${budget.name}" ended on ${formatDate(budget.endDate)}. Close it or start the next period.`,
          link: `/budgets/${budget.id}`,
          timestamp: `${budget.endDate}T23:59:59.000Z`,
        });
      }
    }

    notifications.sort((first, second) => second.timestamp.localeCompare(first.timestamp));
    return HttpResponse.json({ data: notifications.slice(0, LIMIT) });
  }),
];
