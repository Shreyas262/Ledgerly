import type { EntityId, ISODateString } from "../../../types/common";

export interface ExpenseReview {
  reviewedBy: EntityId;
  reviewedAt: ISODateString;
  action: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}
