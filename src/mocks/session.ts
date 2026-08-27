import type { User } from "../types/auth";

const MOCK_SESSION_KEY = "ledgerly.mock.session";

interface MockSession {
  sessionId: string;
  userId: string;
}

export function getMockSession(): MockSession | null {
  const storedSession = localStorage.getItem(MOCK_SESSION_KEY);

  if (!storedSession) {
    return null;
  }

  try {
    return JSON.parse(storedSession) as MockSession;
  } catch {
    localStorage.removeItem(MOCK_SESSION_KEY);
    return null;
  }
}

export function setMockSession(user: User): MockSession {
  const session: MockSession = {
    sessionId: crypto.randomUUID(),
    userId: user.id,
  };

  localStorage.setItem(
    MOCK_SESSION_KEY,
    JSON.stringify(session),
  );

  return session;
}

export function clearMockSession(): void {
  localStorage.removeItem(MOCK_SESSION_KEY);
}