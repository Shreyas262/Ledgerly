import type { Session, SessionStatus } from "../../features/auth/types/auth";
import { getRecord, saveRecord } from "./mockDataService";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface SessionUser {
  id: string;
  organizationId: string;
}

export function buildSession(user: SessionUser): Session {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS);

  return {
    id: crypto.randomUUID(),
    userId: user.id,
    organizationId: user.organizationId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: "active",
  };
}

export async function resolveSession(sessionId: string): Promise<Session | null> {
  const session = await getRecord<Session>("sessions", sessionId);
  if (!session) return null;

  if (session.status !== "active") return null;

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    const expiredSession: Session = {
      ...session,
      status: "expired" as SessionStatus,
    };
    await saveRecord("sessions", expiredSession);
    return null;
  }

  return session;
}

export async function revokeSession(sessionId: string): Promise<Session | null> {
  const session = await getRecord<Session>("sessions", sessionId);
  if (!session) return null;

  const revokedSession: Session = {
    ...session,
    status: "revoked",
    revokedAt: new Date().toISOString(),
  };

  await saveRecord("sessions", revokedSession);
  return revokedSession;
}

export async function revokeSessionInTransaction(
  transaction: IDBTransaction,
  session: Session,
): Promise<Session> {
  const revokedSession: Session = {
    ...session,
    status: "revoked",
    revokedAt: new Date().toISOString(),
  };
  transaction.objectStore("sessions").put(revokedSession);
  return revokedSession;
}


