import { http, HttpResponse } from "msw";

import { getSessionCookieHeader } from "../sessionCookie";
import { resolveSession } from "../services/sessionService";

export const authGuardHandler = http.all("/api/*", async ({ request }) => {
  if (new URL(request.url).pathname.startsWith("/api/auth/")) {
    return;
  }

  const sessionId = getSessionCookieHeader(request);

  if (!sessionId) {
    return HttpResponse.json(
      { message: "Please sign in to continue.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const session = await resolveSession(sessionId);

  if (!session) {
    return HttpResponse.json(
      { message: "Your session has expired. Please sign in again.", code: "INVALID_SESSION" },
      { status: 401 },
    );
  }

  return;
});
