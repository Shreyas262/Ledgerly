import { http, HttpResponse } from "msw";
import { apiError } from "../services/apiError";

import {
  getRecord,
  listRecords,
} from "../services/mockDataService";
import { getSessionCookieHeader } from "../sessionCookie";
import { buildSession, resolveSession, revokeSession, revokeSessionInTransaction } from "../services/sessionService";
import { buildAuthenticatedPrincipal, resolveAuthenticatedPrincipal } from "../services/authorizationService";
import { runAuditedTransaction } from "../services/auditService";
import { hashPassword, isPasswordHash, verifyPassword } from "../services/passwordService";
import type { Session } from "../../features/auth/types/auth";

interface NamedRecord {
  id: string;
  name: string;
}

/** Display names for the user's organization context, so clients never show raw IDs. */
async function resolveContextNames(user: MockUser, authorizedDepartmentIds: string[] = []) {
  const [organization, departments, team] = await Promise.all([
    getRecord<NamedRecord>("organizations", user.organizationId),
    listRecords<NamedRecord>("departments"),
    user.teamId ? getRecord<NamedRecord>("teams", user.teamId) : Promise.resolve(undefined),
  ]);
  const departmentName = (id: string) => departments.find((department) => department.id === id)?.name;

  return {
    organizationName: organization?.name,
    departmentName: departmentName(user.departmentId),
    teamName: team?.name,
    authorizedDepartmentNames: authorizedDepartmentIds
      .map(departmentName)
      .filter((name): name is string => Boolean(name)),
  };
}

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
  status: "active" | "inactive";
}

interface MockCredential {
  userId: string;
  email: string;
  password: string;
}

const API_BASE_URL = "/api";

/** Active, unexpired sessions of a user other than the given one. */
async function otherActiveSessions(userId: string, currentSessionId: string): Promise<Session[]> {
  const now = Date.now();
  return (await listRecords<Session>("sessions")).filter((session) =>
    session.userId === userId &&
    session.id !== currentSessionId &&
    session.status === "active" &&
    new Date(session.expiresAt).getTime() > now);
}

export const authHandlers = [
  // §16.4: the signed-in user's sessions — the current one and how many others are active.
  http.get(`${API_BASE_URL}/auth/sessions`, async ({ request }) => {
    const principal = await resolveAuthenticatedPrincipal(request);
    const sessionId = getSessionCookieHeader(request);
    if (!principal || !sessionId) return apiError(401, "Please sign in to continue.");
    const now = Date.now();
    const sessions = (await listRecords<Session>("sessions")).filter((session) =>
      session.userId === principal.userId && session.status === "active" && new Date(session.expiresAt).getTime() > now);
    const current = sessions.find((session) => session.id === sessionId);
    return HttpResponse.json({
      data: {
        current: current ? { createdAt: current.createdAt, expiresAt: current.expiresAt } : null,
        otherActiveSessions: sessions.filter((session) => session.id !== sessionId).length,
      },
    });
  }),

  // §16.4: sign out of every other session of the signed-in user.
  http.post(`${API_BASE_URL}/auth/sessions/revoke-others`, async ({ request }) => {
    const principal = await resolveAuthenticatedPrincipal(request);
    const sessionId = getSessionCookieHeader(request);
    if (!principal || !sessionId) return apiError(401, "Please sign in to continue.");
    const others = await otherActiveSessions(principal.userId, sessionId);
    await runAuditedTransaction(
      ["sessions"],
      {
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: "SESSIONS_REVOKED",
        entityType: "AUTHENTICATION",
        entityId: principal.userId,
        metadata: { revokedSessions: others.length },
        description: `Signed out of ${others.length} other ${others.length === 1 ? "session" : "sessions"}.`,
      },
      (transaction) => {
        for (const session of others) void revokeSessionInTransaction(transaction, session);
      },
    );
    return HttpResponse.json({ data: { revokedSessions: others.length } });
  }),

  // §16.4: change one's own password. Other sessions are signed out; this one stays.
  http.put(`${API_BASE_URL}/auth/me/password`, async ({ request }) => {
    const principal = await resolveAuthenticatedPrincipal(request);
    const sessionId = getSessionCookieHeader(request);
    if (!principal || !sessionId) return apiError(401, "Please sign in to continue.");

    const body = (await request.json().catch(() => ({}))) as { currentPassword?: unknown; newPassword?: unknown };
    const fieldErrors: Record<string, string> = {};
    if (typeof body.currentPassword !== "string" || !body.currentPassword) fieldErrors.currentPassword = "Enter your current password.";
    if (typeof body.newPassword !== "string" || !body.newPassword) fieldErrors.newPassword = "Enter a new password.";
    if (Object.keys(fieldErrors).length) {
      return apiError(422, "Please correct the highlighted fields.", "VALIDATION_ERROR", { fieldErrors });
    }

    const credential = await getRecord<MockCredential>("credentials", principal.userId);
    if (!credential || !(await verifyPassword(body.currentPassword as string, credential.password))) {
      return apiError(422, "The current password is incorrect.", "VALIDATION_ERROR", {
        fieldErrors: { currentPassword: "The current password is incorrect." },
      });
    }
    if (body.newPassword === body.currentPassword) {
      return apiError(422, "The new password must be different from the current password.", "VALIDATION_ERROR", {
        fieldErrors: { newPassword: "The new password must be different from the current password." },
      });
    }

    const updatedCredential = { ...credential, password: await hashPassword(body.newPassword as string) };
    const others = await otherActiveSessions(principal.userId, sessionId);
    await runAuditedTransaction(
      ["credentials", "sessions"],
      {
        organizationId: principal.organizationId,
        actorId: principal.userId,
        action: "PASSWORD_CHANGED",
        entityType: "AUTHENTICATION",
        entityId: principal.userId,
        metadata: { revokedSessions: others.length },
        description: "Changed own password.",
      },
      (transaction) => {
        transaction.objectStore("credentials").put(updatedCredential);
        for (const session of others) void revokeSessionInTransaction(transaction, session);
      },
    );
    return HttpResponse.json({ data: { revokedSessions: others.length } });
  }),
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      email?: unknown;
      password?: unknown;
    };

    if (typeof body.email !== "string" || typeof body.password !== "string" || !body.email.trim() || !body.password) {
      return apiError(422, "Email and password are required.");
    }

    const credentials = await listRecords<MockCredential>("credentials");
    let credential: MockCredential | undefined;

    for (const item of credentials) {
      if (item.email.toLowerCase() !== body.email.trim().toLowerCase()) continue;
      if (await verifyPassword(body.password, item.password)) {
        credential = item;
        break;
      }
    }

    if (!credential) {
      return apiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }

    const user = await getRecord<MockUser>(
      "users",
      credential.userId,
    );

    if (!user) {
      return apiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }

    if (!isPasswordHash(credential.password)) {
      credential.password = await hashPassword(body.password);
      await runAuditedTransaction(
        ["credentials"],
        {
          organizationId: user.organizationId,
          actorId: credential.userId,
          action: "CREDENTIAL_MIGRATED",
          entityType: "AUTHENTICATION",
          entityId: credential.userId,
          newState: "hashed",
          description: "Password security was updated.",
        },
        (transaction) => {
          transaction.objectStore("credentials").put(credential);
        },
      );
    }

    if (user.status !== "active") {
      return apiError(403, "This user account is inactive.", "ACCOUNT_INACTIVE");
    }

    const session = buildSession(user);
    const principal = await buildAuthenticatedPrincipal(user);

    if (!principal) {
      return apiError(401, "Your session could not be verified. Please sign in again.", "INVALID_SESSION");
    }

    const authenticatedUser = {
      ...user,
      role: principal.role,
      permissions: principal.effectivePermissions,
      authorizedDepartmentIds: principal.authorizedDepartmentIds,
    };

    await runAuditedTransaction(
      ["sessions"],
      {
        organizationId: user.organizationId,
        actorId: user.id,
        action: "LOGIN",
        entityType: "AUTHENTICATION",
        entityId: user.id,
        newState: "active",
        metadata: { sessionId: session.id },
        description: "Signed in to Ledgerly.",
      },
      (transaction) => {
        transaction.objectStore("sessions").put(session);
      },
    );

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

      if (user && session) {
        await runAuditedTransaction(
          ["sessions"],
          {
            organizationId: user.organizationId,
            actorId: user.id,
            action: "LOGOUT",
            entityType: "AUTHENTICATION",
            entityId: user.id,
            previousState: "active",
            newState: "revoked",
            metadata: { sessionId },
            description: "Signed out of Ledgerly.",
          },
          (transaction) => {
            revokeSessionInTransaction(transaction, session);
          },
        );
      } else {
        await revokeSession(sessionId);
      }
    }

    return HttpResponse.json({
      data: null,
    });
  }),

  http.get(`${API_BASE_URL}/auth/me`, async ({ request }) => {
    const sessionId = getSessionCookieHeader(request);

    if (!sessionId) {
      return apiError(401, "No active session.");
    }

    const session = await resolveSession(sessionId);

    if (!session) {
      return apiError(401, "Your session has expired. Please sign in again.", "INVALID_SESSION");
    }

    const user = await getRecord<MockUser>("users", session.userId);

    if (!user) {
      await revokeSession(sessionId);
      return apiError(401, "Your session is no longer valid. Please sign in again.", "INVALID_SESSION");
    }

    const principal = await resolveAuthenticatedPrincipal(request);

    if (!principal) {
      await revokeSession(sessionId);
      return apiError(401, "Your session is no longer valid. Please sign in again.", "INVALID_SESSION");
    }

    return HttpResponse.json({
      data: {
        ...user,
        role: principal.role,
        permissions: principal.effectivePermissions,
        authorizedDepartmentIds: principal.authorizedDepartmentIds,
        ...(await resolveContextNames(user, principal.authorizedDepartmentIds)),
      },
    });
  }),

  // Self-service profile update. Only personal fields are editable here;
  // role and organizational membership remain administrative operations.
  http.put(`${API_BASE_URL}/auth/me`, async ({ request }) => {
    const principal = await resolveAuthenticatedPrincipal(request);

    if (!principal) {
      return apiError(401, "Please sign in to continue.");
    }

    const user = await getRecord<MockUser>("users", principal.userId);

    if (!user) {
      return apiError(401, "Your session is no longer valid. Please sign in again.", "INVALID_SESSION");
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      email?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const fieldErrors: Record<string, string> = {};

    if (!name) fieldErrors.name = "Name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "A valid email address is required.";
    if (Object.keys(fieldErrors).length) {
      return apiError(422, "Please correct the highlighted fields.", "VALIDATION_ERROR", { fieldErrors });
    }

    const users = await listRecords<MockUser>("users");
    if (users.some((item) => item.id !== user.id && item.email.toLowerCase() === email.toLowerCase())) {
      return apiError(409, "A user with this email already exists.");
    }

    const credential = await getRecord<MockCredential>("credentials", user.id);
    const updatedUser: MockUser & { updatedAt: string } = {
      ...user,
      name,
      email,
      updatedAt: new Date().toISOString(),
    };

    await runAuditedTransaction(
      ["users", "credentials"],
      {
        organizationId: user.organizationId,
        actorId: user.id,
        action: "USER_UPDATED",
        entityType: "USER",
        entityId: user.id,
        metadata: {
          changes: (["name", "email"] as const)
            .filter((field) => user[field] !== updatedUser[field])
            .map((field) => ({ field, previousValue: user[field], newValue: updatedUser[field] })),
        },
        description: "Updated own profile.",
      },
      (transaction) => {
        transaction.objectStore("users").put(updatedUser);
        if (credential) {
          transaction.objectStore("credentials").put({ ...credential, email });
        }
      },
    );

    return HttpResponse.json({
      data: {
        ...updatedUser,
        role: principal.role,
        permissions: principal.effectivePermissions,
        authorizedDepartmentIds: principal.authorizedDepartmentIds,
      },
    });
  }),
];
