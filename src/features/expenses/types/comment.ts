import type { EntityId, ISODateString } from "../../../types/common";

/** Longest comment, in characters. */
export const MAX_COMMENT_LENGTH = 1_000;

/** A message in an expense's discussion between its owner and reviewers. */
export interface ExpenseComment {
  id: EntityId;
  expenseId: EntityId;
  authorId: EntityId;
  /** Display name and role of the author, resolved by the API. */
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: ISODateString;
}

/** A thread with whether the signed-in user may add to it, and if not, why. */
export interface ExpenseCommentThread {
  comments: ExpenseComment[];
  canComment: boolean;
  closedReason?: string;
}
