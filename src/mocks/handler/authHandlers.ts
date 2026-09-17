import { http, HttpResponse } from "msw";

import { users } from "../data/users";
import { credentials } from "../data/credentials";
import { auditLogs } from "../data/auditLogs";
import {
  clearMockSession,
  getMockSession,
  setMockSession,
} from "../session";

const API_BASE_URL = "/api";

export const authHandlers = [
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as {
      email: string;
      password: string;
    };

    const credential = credentials.find(
      (item) =>
        item.email === body.email &&
        item.password === body.password,
    );

    if (!credential) {
      return HttpResponse.json(
        {
          message: "Invalid email or password",
        },
        {
          status: 401,
        },
      );
    }

    const user = users.find(
      (item) => item.id === credential.userId,
    );

    if (!user) {
      return HttpResponse.json(
        {
          message: "User not found",
        },
        {
          status: 404,
        },
      );
    }

    const session = setMockSession(user);

    auditLogs.push({
      id: crypto.randomUUID(),
      organizationId: user.organizationId,
      actorId: user.id,
      actorName: user.name,
      action: "login",
      resource: "auth",
      resourceId: user.id,
      description: "Signed in to Ledgerly.",
      createdAt: new Date().toISOString(),
    });

    return HttpResponse.json({
      data: {
        user,
        sessionId: session.sessionId,
        isAuthenticated: true,
      },
    });
  }),

  http.post(`${API_BASE_URL}/auth/logout`, () => {
    const session = getMockSession();

    if (session) {
      const user = users.find(
        (item) => item.id === session.userId,
      );

      if (user) {
        auditLogs.push({
          id: crypto.randomUUID(),
          organizationId: user.organizationId,
          actorId: user.id,
          actorName: user.name,
          action: "logout",
          resource: "auth",
          resourceId: user.id,
          description: "Signed out of Ledgerly.",
          createdAt: new Date().toISOString(),
        });
      }
    }

    clearMockSession();

    return HttpResponse.json({
      data: null,
    });
  }),

  http.get(`${API_BASE_URL}/auth/me`, () => {
    const session = getMockSession();

    if (!session) {
      return HttpResponse.json(
        {
          message: "No active session.",
          code: "UNAUTHENTICATED",
        },
        { status: 401 },
      );
    }

    const user = users.find(
      (u) => session.userId === u.id,
    );

    if (!user) {
      clearMockSession();

      return HttpResponse.json(
        {
          message: "Invalid session.",
          code: "INVALID_SESSION",
        },
        { status: 401 },
      );
    }

    return HttpResponse.json({
      data: user,
    });
  }),
];