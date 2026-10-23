import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

import { handlers } from "../mocks/handlers";
import { EXCHANGE_RATE_SERVICE_URL } from "../mocks/services/exchangeRateService";
import type { CurrencyCode } from "../types/common";
import { toDateOnly } from "../utils/format";

const SESSION_COOKIE_NAME = "ledgerly.session";

export const server = setupServer(...handlers);

/** Runs the application's mock API for the tests in the calling file. */
export function setupApiServer(): void {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

/** The business day a rate is published for: Friday for a weekend date. */
function publishedDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  const weekday = day.getUTCDay();
  day.setUTCDate(day.getUTCDate() - (weekday === 0 ? 2 : weekday === 6 ? 1 : 0));
  return day.toISOString().slice(0, 10);
}

/**
 * Answers the exchange rate service with fixed rates (rupees per unit), the
 * way it answers: weekends take Friday's rate, "latest" is today's, and other
 * currencies or later dates are not found. Tests never reach the real service.
 */
export function serveExchangeRates(rupeesPerUnit: Partial<Record<CurrencyCode, number>>): void {
  server.use(
    http.get(`${EXCHANGE_RATE_SERVICE_URL}/:day`, ({ params, request }) => {
      const base = new URL(request.url).searchParams.get("base") as CurrencyCode;
      const today = toDateOnly();
      const day = params.day === "latest" ? today : String(params.day);
      const rate = rupeesPerUnit[base];
      if (!rate || day > today) return HttpResponse.json({ message: "not found" }, { status: 404 });
      return HttpResponse.json({ amount: 1, base, date: publishedDay(day), rates: { INR: rate } });
    }),
  );
}

/** Makes the exchange rate service unreachable. */
export function failExchangeRateService(): void {
  server.use(http.get(`${EXCHANGE_RATE_SERVICE_URL}/:day`, () => HttpResponse.error()));
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
  platform: { email: "platform@ledgerly.com", password: "platform123" },
} as const;
