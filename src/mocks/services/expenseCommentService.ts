import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type { Expense, ExpenseStatus } from "../../features/expenses/types/expense";
import { MAX_COMMENT_LENGTH, type ExpenseComment } from "../../features/expenses/types/comment";
import { runAuditedTransaction } from "./auditService";
import { getRecord, listRecordsByIndex } from "./mockDataService";

/** A comment as stored; author details are resolved when it is read. */
export interface StoredExpenseComment {
  id: string;
  organizationId: string;
  expenseId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

// The thread stays readable in every status; it only takes new comments while
// the expense is in the workflow (§29.10).
const CLOSED_REASONS: Partial<Record<ExpenseStatus, string>> = {
  draft: "Comments can be added once the expense has been submitted.",
  reimbursed: "Comments are closed because this expense has been reimbursed.",
  cancelled: "Comments are closed because this expense has been cancelled.",
};

/** Why an expense in this status takes no new comments, or undefined when it does. */
export function getCommentClosedReason(status: ExpenseStatus): string | undefined {
  return CLOSED_REASONS[status];
}

export type AddCommentResult =
  | { ok: true; comment: ExpenseComment }
  | { ok: false; status: 409 | 422; message: string; fieldErrors?: Record<string, string> };

/** Stored comments of an expense, oldest first. */
export async function getStoredComments(expenseId: string): Promise<StoredExpenseComment[]> {
  const comments = await listRecordsByIndex<StoredExpenseComment>("expenseComments", "expenseId", expenseId);
  return comments.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}

async function withAuthors(comments: StoredExpenseComment[]): Promise<ExpenseComment[]> {
  const authors = new Map<string, { name: string; role: string }>();
  for (const authorId of new Set(comments.map((comment) => comment.authorId))) {
    const user = await getRecord<{ name: string; roleId: string; role?: string }>("users", authorId);
    const role = user ? await getRecord<{ name: string }>("roles", user.roleId) : undefined;
    authors.set(authorId, { name: user?.name ?? "Former user", role: String(role?.name ?? user?.role ?? "") });
  }
  return comments.map((comment) => ({
    id: comment.id,
    expenseId: comment.expenseId,
    authorId: comment.authorId,
    authorName: authors.get(comment.authorId)?.name ?? "Former user",
    authorRole: authors.get(comment.authorId)?.role ?? "",
    body: comment.body,
    createdAt: comment.createdAt,
  }));
}

/** The expense's discussion, oldest first, with each author's name and role. */
export async function listExpenseComments(expenseId: string): Promise<ExpenseComment[]> {
  return withAuthors(await getStoredComments(expenseId));
}

/**
 * Adds a comment to an expense the principal is authorized to read. The
 * comment and its audit event are written in one transaction.
 */
export async function addExpenseComment(
  principal: AuthenticatedPrincipal,
  expense: Pick<Expense, "id" | "organizationId" | "title" | "status">,
  rawBody: unknown,
): Promise<AddCommentResult> {
  const closedReason = getCommentClosedReason(expense.status);
  if (closedReason) return { ok: false, status: 409, message: closedReason };

  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  const bodyError = !body
    ? "Enter a comment."
    : body.length > MAX_COMMENT_LENGTH
      ? `Use at most ${MAX_COMMENT_LENGTH} characters.`
      : undefined;
  if (bodyError) {
    return { ok: false, status: 422, message: "Please correct the highlighted fields.", fieldErrors: { body: bodyError } };
  }

  const comment: StoredExpenseComment = {
    id: crypto.randomUUID(),
    organizationId: expense.organizationId,
    expenseId: expense.id,
    authorId: principal.userId,
    body,
    createdAt: new Date().toISOString(),
  };

  await runAuditedTransaction(
    ["expenseComments"],
    {
      organizationId: expense.organizationId,
      actorId: principal.userId,
      action: "EXPENSE_COMMENTED",
      entityType: "EXPENSE",
      entityId: expense.id,
      newState: expense.status,
      // The text stays in the thread; the audit log records that it was written.
      metadata: { commentId: comment.id, length: body.length },
      description: `Commented on expense ${expense.title}.`,
      timestamp: comment.createdAt,
    },
    (transaction) => {
      transaction.objectStore("expenseComments").put(comment);
    },
  );

  const [withAuthor] = await withAuthors([comment]);
  return { ok: true, comment: withAuthor };
}
