import { http, HttpResponse } from "msw";

import {
  getRecord,
  listRecords,
  saveRecord,
} from "../services/mockDataService";
import { getSessionCookieHeader } from "../sessionCookie";
import { createSession, resolveSession, revokeSession } from "../services/sessionService";
import { buildAuthenticatedPrincipal, resolveAuthenticatedPrincipal } from "../services/authorizationService";

interface MockUser {
  id: string;
  organizationId: string;
  departmentId: string;
  teamId: string;
  roleId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

interface MockCredential {
  userId: string;
  email: string;
  password: string;
}

const API_BASE_URL = "/api";

export const authHandlers = [
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as {
      email: string;
      password: string;
    };

    const credentials =
      await listRecords<MockCredential>("credentials");

    const credential = credentials.find(
      (item) =>
        item.email === body.email &&
        item.password === body.password,
    );

    if (!credential) {
      return HttpResponse.json(
        { message: "Invalid email or password" },
        { status: 401 },
      );
    }

    const user = await getRecord<MockUser>(
      "users",
      credential.userId,
    );

    if (!user) {
      return HttpResponse.json(
        { message: "User not found" },
        { status: 404 },
      );
    }

    const session = await createSession(user);
    const principal = await buildAuthenticatedPrincipal(user);

    if (!principal) {
      await revokeSession(session.id);
      return HttpResponse.json(
        { message: "Unable to resolve authenticated principal.", code: "INVALID_SESSION" },
        { status: 401 },
      );
    }

    const authenticatedUser = {
      ...user,
      permissions: principal.effectivePermissions,
    };

    await saveRecord("auditEvents", {
      id: crypto.randomUUID(),
      organizationId: user.organizationId,
      actorId: user.id,
      action: "login",
      resource: "auth",
      resourceId: user.id,
      description: "Signed in to Ledgerly.",
      createdAt: new Date().toISOString(),
    });

    return HttpResponse.json({
      data: {
        user: authenticatedUser,
        sessionId: session.id,
        expiresAt: session.expiresAt,
        isAuthenticated: true,
      },
    });
  }),

  http.post(`${API_BASE_URL}/auth/logout`, async ({ request }) => {
    const sessionId = getSessionCookieHeader(request);

    if (sessionId) {
      const session = await resolveSession(sessionId);
      const user = session
        ? await getRecord<MockUser>("users", session.userId)
        : undefined;

      if (user) {
        await saveRecord("auditEvents", {
          id: crypto.randomUUID(),
          organizationId: user.organizationId,
          actorId: user.id,
          action: "logout",
          resource: "auth",
          resourceId: user.id,
          description: "Signed out of Ledgerly.",
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (sessionId) {
      await revokeSession(sessionId);
    }

    return HttpResponse.json({
      data: null,
    });
  }),

  http.get(`${API_BASE_URL}/auth/me`, async ({ request }) => {
    const sessionId = getSessionCookieHeader(request);

    if (!sessionId) {
      return HttpResponse.json(
        { message: "No active session.", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const session = await resolveSession(sessionId);

    if (!session) {
      return HttpResponse.json(
        { message: "Invalid or expired session.", code: "INVALID_SESSION" },
        { status: 401 },
      );
    }

    const user = await getRecord<MockUser>("users", session.userId);

    if (!user) {
      await revokeSession(sessionId);
      return HttpResponse.json(
        { message: "Invalid session.", code: "INVALID_SESSION" },
        { status: 401 },
      );
    }

    const principal = await resolveAuthenticatedPrincipal(request);

    if (!principal) {
      await revokeSession(sessionId);
      return HttpResponse.json(
        { message: "Invalid session.", code: "INVALID_SESSION" },
        { status: 401 },
      );
    }

    return HttpResponse.json({
      data: {
        ...user,
        permissions: principal.effectivePermissions,
      },
    });
  }),
];
