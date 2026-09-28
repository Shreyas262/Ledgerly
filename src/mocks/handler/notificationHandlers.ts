import { http, HttpResponse } from "msw";
import { apiError } from "../services/apiError";
import { resolveAuthenticatedPrincipal } from "../services/authorizationService";
import { listRecords, listRecordsByIndex } from "../services/mockDataService";
import { getApprovalQueue } from "../services/approvalService";
import { getReimbursementQueue } from "../services/reimbursementService";
import { authorizeExpenseFinance } from "../services/workflowAuthorization";
import { getExpenseCreationEligibility, todayDate } from "../services/budgetService";
import type { Expense } from "../../features/expenses/types/expense";
import type { AuditEvent } from "../../features/audit/types/audit";
import type { OrganizationBudget } from "../../features/budgets/types/budget";
import type { AppNotification } from "../../features/notifications/types/notification";
import { formatCurrency } from "../../utils/currency";
import { formatDate } from "../../utils/format";

const WINDOW_DAYS = 30;
const LIMIT = 40;

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

    for (const event of events) {
      // Reimbursement events are recorded against the expense id.
      if ((event.entityType !== "EXPENSE" && event.entityType !== "REIMBURSEMENT") || new Date(event.timestamp).getTime() < since) continue;
      const expense = expenseById.get(event.entityId);
      if (!expense) continue;
      const base = { id: event.id, link: `/expenses/${expense.id}`, timestamp: event.timestamp };
      const byOther = event.actorId !== principal.userId;
      const label = `"${expense.title}"`;

      switch (event.action) {
        case "EXPENSE_REVIEWED":
          if (byOther) notifications.push({ ...base, category: "EXPENSE_UPDATES", severity: "info", title: "Review started", message: `${nameOf(event.actorId)} started reviewing ${label}.` });
          break;
        case "EXPENSE_APPROVED":
          if (byOther) notifications.push({ ...base, category: "EXPENSE_UPDATES", severity: "success", title: "Expense approved", message: `${label} was approved by ${nameOf(event.actorId)}.` });
          break;
        case "EXPENSE_REJECTED":
          if (byOther) notifications.push({ ...base, category: "EXPENSE_UPDATES", severity: "error", title: "Expense rejected", message: `${label} was rejected by ${nameOf(event.actorId)}.${expense.rejectionReason ? ` Reason: ${expense.rejectionReason}` : ""}` });
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

    // Work waiting for the user.
    const reviewQueue = await getApprovalQueue(principal);
    if (reviewQueue.length) {
      const waiting = reviewQueue.filter((expense) => expense.status === "submitted");
      notifications.push({
        id: "queue-review",
        category: "REVIEW_QUEUE",
        severity: "info",
        title: "Expenses awaiting review",
        message: `${reviewQueue.length} ${reviewQueue.length === 1 ? "expense is" : "expenses are"} in your review queue${waiting.length ? `, ${waiting.length} not yet started` : ""}.`,
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
