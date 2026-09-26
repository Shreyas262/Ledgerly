import type { EntityId, ISODateString } from "../../../types/common";

export interface Document {
  id: EntityId;
  organizationId: EntityId;
  expenseId: EntityId;
  uploadedBy: EntityId;
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  status: DocumentStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type DocumentStatus = "UPLOADED" | "ACTIVE" | "REMOVED";
