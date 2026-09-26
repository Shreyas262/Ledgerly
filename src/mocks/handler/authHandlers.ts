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

export const authHandlers = [
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
          description: "Migrated a legacy development credential to a password hash.",
        },
        (transaction) => {
          transaction.objectStore("credentials").put(credential);
        },
      );
    }

    if (user.status === "inactive") {
      return apiError(403, "This user account is inactive.", "ACCOUNT_INACTIVE");
    }

    const session = buildSession(user);
    const principal = await buildAuthenticatedPrincipal(user);

    if (!principal) {
      return apiError(401, "Unable to resolve authenticated principal.", "INVALID_SESSION");
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
      return apiError(401, "Invalid or expired session.", "INVALID_SESSION");
    }

    const user = await getRecord<MockUser>("users", session.userId);

    if (!user) {
      await revokeSession(sessionId);
      return apiError(401, "Invalid session.", "INVALID_SESSION");
    }

    const principal = await resolveAuthenticatedPrincipal(request);

    if (!principal) {
      await revokeSession(sessionId);
      return apiError(401, "Invalid session.", "INVALID_SESSION");
    }

    return HttpResponse.json({
      data: {
        ...user,
        role: principal.role,
        permissions: principal.effectivePermissions,
        authorizedDepartmentIds: principal.authorizedDepartmentIds,
      },
    });
  }),

  // Self-service profile update. Only personal fields are editable here;
  // role and organizational membership remain administrative operations.
  http.put(`${API_BASE_URL}/auth/me`, async ({ request }) => {
    const principal = await resolveAuthenticatedPrincipal(request);

    if (!principal) {
      return apiError(401, "Authentication required.");
    }

    const user = await getRecord<MockUser>("users", principal.userId);

    if (!user) {
      return apiError(401, "Invalid session.", "INVALID_SESSION");
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
      return apiError(422, "Profile validation failed.", "VALIDATION_ERROR", { fieldErrors });
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
