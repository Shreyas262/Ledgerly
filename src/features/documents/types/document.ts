import type { EntityId, ResourceTimestamps } from "../../../types/common";

export interface Document extends ResourceTimestamps {
  id: EntityId;
  organizationId: EntityId;
  expenseId: EntityId;
  uploadedBy: EntityId;
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  status: DocumentStatus;
}

export type DocumentStatus = "ACTIVE" | "REPLACED" | "REMOVED";
