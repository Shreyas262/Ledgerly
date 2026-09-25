import type { AuditAction, AuditEntityType, AuditEvent } from "../../features/audit/types/audit";
import { indexedDbRepository } from "../repositories/indexedDbRepository";
import type { MockStoreName } from "../db/indexedDb";

export interface AuditEventInput {
  organizationId: string;
  actorId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  previousState?: string;
  newState?: string;
  metadata?: Record<string, unknown>;
  description?: string;
  timestamp?: string;
}

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  return {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    timestamp: input.timestamp ?? new Date().toISOString(),
    ...(input.previousState ? { previousState: input.previousState } : {}),
    ...(input.newState ? { newState: input.newState } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(input.description ? { description: input.description } : {}),
  };
}

export function appendAuditEvent(
  transaction: IDBTransaction,
  input: AuditEventInput,
): AuditEvent {
  const event = createAuditEvent(input);
  transaction.objectStore("auditEvents").put(event);
  return event;
}

export async function runAuditedTransaction<T>(
  storeNames: MockStoreName[],
  audit: AuditEventInput,
  mutation: (transaction: IDBTransaction) => T,
): Promise<T> {
  return indexedDbRepository.transaction(
    Array.from(new Set([...storeNames, "auditEvents"])),
    (transaction) => {
      const result = mutation(transaction);
      appendAuditEvent(transaction, audit);
      return result;
    },
  );
}
