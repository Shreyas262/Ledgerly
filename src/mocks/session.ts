/**
 * Session access is intentionally cookie-based. Business session authority
 * lives in IndexedDB; this module only exposes the current session identifier
 * for existing client-side utilities.
 */
import { getSessionCookie } from "./sessionCookie";
import { resolveSession } from "./services/sessionService";

export interface MockSessionReference {
  sessionId: string;
}

export function getMockSession(): MockSessionReference | null {
  const sessionId = getSessionCookie();
  return sessionId ? { sessionId } : null;
}

export async function getResolvedMockSession(): Promise<MockSessionReference | null> {
  const sessionId = getSessionCookie();

  if (!sessionId) {
    return null;
  }

  const session = await resolveSession(sessionId);
  return session ? { sessionId: session.id } : null;
}
