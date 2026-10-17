import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

import { handlers } from "../mocks/handlers";

const SESSION_COOKIE_NAME = "ledgerly.session";

export const server = setupServer(...handlers);

/** Runs the application's mock API for the tests in the calling file. */
export function setupApiServer(): void {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

/** Sends a request to the mock API, optionally as a signed-in user. */
export function apiFetch(
  path: string,
  init: RequestInit = {},
  sessionCookie?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (sessionCookie) headers.set("cookie", sessionCookie);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  // The cookie is sent explicitly; omitting credentials keeps the handlers from
  // falling back to document.cookie.
  return fetch(new URL(path, location.origin), { ...init, headers, credentials: "omit" });
}

/** Signs in through the API and returns the session cookie for later requests. */
export async function signIn(email: string, password: string): Promise<string> {
  const response = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Sign-in failed for ${email}: ${response.status}`);
  }

  const { data } = (await response.json()) as { data: { sessionId: string } };
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(data.sessionId)}`;
}

export const demoAccounts = {
  employee: { email: "employee@ledgerly.com", password: "employee123" },
  manager: { email: "manager@ledgerly.com", password: "manager123" },
  finance: { email: "finance@ledgerly.com", password: "finance123" },
  admin: { email: "admin@ledgerly.com", password: "admin123" },
  personal: { email: "personal@ledgerly.com", password: "personal123" },
} as const;
