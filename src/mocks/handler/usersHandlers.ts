import { apiError } from "../services/apiError";
import { applyCollectionQueryResult, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";

import {
  authorizeCollection,
  authorizeRequest,
} from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { runAuditedTransaction } from "../services/auditService";
import { hashPassword } from "../services/passwordService";
import { findOtherActiveManager } from "./organizationHandlers";

/** One manager per team: the response when the team already has one. */
async function teamManagerConflict(teamId: string, userId: string | undefined) {
  const existingManager = await findOtherActiveManager(teamId, userId);
  return existingManager
    ? apiError(409, `This team already has a manager (${String(existingManager.name ?? existingManager.id)}). A team can have only one manager.`, "TEAM_HAS_MANAGER")
    : null;
}

import {
  getRecord,
  listRecords,
  listRecordsByIndex,
} from "../services/mockDataService";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  status: "active" | "inactive" | "deleted";
  financeDepartmentIds?: string[];
}

interface MockCredential {
  userId: string;
  email: string;
  password: string;
}

const API_BASE_URL = "/api";

/**
 * Validates explicit finance authority (§22.7). Only Finance users carry it;
 * every department must be an active department of the same organization.
 */
async function resolveFinanceDepartmentIds(
  value: unknown,
  roleName: string,
  organizationId: string,
  current?: string[],
): Promise<{ ids?: string[] } | { error: string }> {
  if (roleName !== "finance") return { ids: undefined };
  if (value === undefined) return { ids: current };
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) {
    return { error: "Select authorized departments from the list." };
  }

  const ids = Array.from(new Set(value as string[]));
  const departments = await listRecords<{ id: string; organizationId: string; status?: string }>("departments");
  const valid = new Set(
    departments
      .filter((item) => item.organizationId === organizationId && item.status !== "inactive")
      .map((item) => item.id),
  );

  if (ids.some((id) => !valid.has(id))) {
    return { error: "Authorized departments must be active departments of this organization." };
  }

  return { ids: ids.length ? ids : undefined };
}

export const usersHandlers = [
  http.get(`${API_BASE_URL}/users`, async ({ request }) => {
    const result = await authorizeCollection(
      request,
      await listRecords<MockUser>("users"),
      {
        permission: "users.read",
        scope: "ORGANIZATION",
        getResource: (user) => ({ organizationId: user.organizationId }),
      },
    );

    if (!result.allowed) {
      return authorizationError(result);
    }

    const roles = await listRecords<{ id: string; permissions: string[] }>("roles");
    const rolePermissions = new Map(roles.map((role) => [role.id, role.permissions]));
    // Removed users are kept only so their historical records stay attributable.
    const records = result.records.filter((user) => user.status !== "deleted").map((user) => ({
      ...user,
      permissions: rolePermissions.get(user.roleId) ?? user.permissions,
    }));
    return HttpResponse.json(applyCollectionQueryResult(records, parseCollectionQuery(request)));
  }),

  http.post(`${API_BASE_URL}/users`, async ({ request }) => {
    const authorization = await authorizeRequest(request, {
      permission: "users.create",
      scope: "ORGANIZATION",
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }
    const body = (await request.json().catch(() => ({}))) as {
      organizationId: string;
      departmentId?: string;
      teamId?: string;
      roleId?: string;
      name: string;
      email: string;
      role: string;
      permissions: string[];
      password: string;
      status?: "active" | "inactive";
      financeDepartmentIds?: unknown;
    };

    const fieldErrors: Record<string, string> = {};
    if (typeof body.name !== "string" || !body.name.trim()) fieldErrors.name = "Name is required.";
    if (typeof body.email !== "string" || !EMAIL_PATTERN.test(body.email.trim())) fieldErrors.email = "A valid email address is required.";
    if (typeof body.password !== "string" || !body.password) fieldErrors.password = "Password is required.";
    // §8.7: organizational membership is explicit and never inferred.
    if (typeof body.departmentId !== "string" || !body.departmentId) fieldErrors.departmentId = "Department is required.";
    if (typeof body.teamId !== "string" || !body.teamId) fieldErrors.teamId = "Team is required.";
    if (Object.keys(fieldErrors).length) {
      return apiError(422, "Please correct the highlighted fields.", "VALIDATION_ERROR", { fieldErrors });
    }

    const email = body.email.trim();
    const users = await listRecords<MockUser>("users");

    // Removed users' emails may be reused.
    if (users.some((user) => user.status !== "deleted" && user.email.toLowerCase() === email.toLowerCase())) {
      return apiError(409, "A user with this email already exists.");
    }

    const role = body.roleId
      ? await getRecord<{ id: string; organizationId: string; name: string; permissions: string[] }>("roles", body.roleId)
      : (await listRecords<{ id: string; organizationId: string; name: string; permissions: string[] }>("roles")).find((item) => item.organizationId === authorization.principal.organizationId && item.name === body.role);
    const department = await getRecord<{ id: string; organizationId: string; status?: string }>("departments", body.departmentId!);
    const team = await getRecord<{ id: string; organizationId: string; departmentId: string; status?: string }>("teams", body.teamId!);
    if (!role || role.organizationId !== authorization.principal.organizationId || !department || department.organizationId !== authorization.principal.organizationId || !team || team.organizationId !== authorization.principal.organizationId || team.departmentId !== department.id || department.status === "inactive" || team.status === "inactive") {
      return apiError(422, "Select a valid role, and a team that belongs to the selected active department.");
    }

    const financeAuthority = await resolveFinanceDepartmentIds(
      body.financeDepartmentIds,
      role.name,
      authorization.principal.organizationId,
    );
    if ("error" in financeAuthority) {
      return apiError(422, financeAuthority.error, "VALIDATION_ERROR", {
        fieldErrors: { financeDepartmentIds: financeAuthority.error },
      });
    }

    if (role.name.toLowerCase() === "manager" && (body.status ?? "active") === "active") {
      const conflict = await teamManagerConflict(team.id, undefined);
      if (conflict) return conflict;
    }

    const passwordHash = await hashPassword(body.password);

    const newUser: MockUser = {
      id: crypto.randomUUID(),
      organizationId: authorization.principal.organizationId,
      departmentId: department.id,
      teamId: team.id,
      roleId: role.id,
      name: body.name.trim(),
      email,
      role: role.name,
      permissions: role.permissions,
      status: body.status ?? "active",
      ...(financeAuthority.ids ? { financeDepartmentIds: financeAuthority.ids } : {}),
    };

    await runAuditedTransaction(
      ["users", "credentials"],
      {
        organizationId: newUser.organizationId,
        actorId: authorization.principal.userId,
        action: "USER_CREATED",
        entityType: "USER",
        entityId: newUser.id,
        newState: "active",
        metadata: { roleId: newUser.roleId, departmentId: newUser.departmentId, teamId: newUser.teamId, financeDepartmentIds: newUser.financeDepartmentIds },
        description: `Created user ${newUser.name}.`,
      },
      (transaction) => {
        transaction.objectStore("users").put(newUser);
        transaction.objectStore("credentials").put({
          userId: newUser.id,
          email,
          password: passwordHash,
        });
      },
    );

    return HttpResponse.json(newUser, { status: 201 });
  }),

  http.put(
    `${API_BASE_URL}/users/:id`,
    async ({ params, request }) => {
      const userId = String(params.id);
      const body = (await request.json().catch(() => ({}))) as {
        name: string;
        email: string;
        role: string;
        permissions: string[];
        departmentId?: string;
        teamId?: string;
        roleId?: string;
        password?: string;
        status?: "active" | "inactive";
        financeDepartmentIds?: unknown;
      };

      const currentUser = await getRecord<MockUser>(
        "users",
        userId,
      );

      if (!currentUser || currentUser.status === "deleted") {
        return apiError(404, "User not found.");
      }

      const authorization = await authorizeRequest(request, {
        permission: "users.update",
        scope: "ORGANIZATION",
        resource: { organizationId: currentUser.organizationId },
      });

      if (!authorization.allowed) {
        return authorizationError(authorization);
      }

      const fieldErrors: Record<string, string> = {};
      if (typeof body.name !== "string" || !body.name.trim()) fieldErrors.name = "Name is required.";
      if (typeof body.email !== "string" || !EMAIL_PATTERN.test(body.email.trim())) fieldErrors.email = "A valid email address is required.";
      if (body.password !== undefined && typeof body.password !== "string") fieldErrors.password = "Enter a valid password.";
      if (Object.keys(fieldErrors).length) {
        return apiError(422, "Please correct the highlighted fields.", "VALIDATION_ERROR", { fieldErrors });
      }

      const email = body.email.trim();
      const users = await listRecords<MockUser>("users");

      if (
        users.some(
          (user) =>
            user.id !== userId &&
            user.status !== "deleted" &&
            user.email.toLowerCase() === email.toLowerCase(),
        )
      ) {
        return apiError(409, "A user with this email already exists.");
      }

      const role = body.roleId
        ? await getRecord<{ id: string; organizationId: string; name: string; permissions: string[] }>("roles", body.roleId)
        : (await listRecords<{ id: string; organizationId: string; name: string; permissions: string[] }>("roles")).find((item) => item.organizationId === currentUser.organizationId && item.name === body.role);
      const department = await getRecord<{ id: string; organizationId: string; status?: string }>("departments", body.departmentId ?? currentUser.departmentId);
      const team = await getRecord<{ id: string; organizationId: string; departmentId: string; status?: string }>("teams", body.teamId ?? currentUser.teamId);
      if (!role || role.organizationId !== currentUser.organizationId || !department || department.organizationId !== currentUser.organizationId || !team || team.organizationId !== currentUser.organizationId || team.departmentId !== department.id || department.status === "inactive" || team.status === "inactive") {
        return apiError(422, "Select a valid role, and a team that belongs to the selected active department.");
      }

      const financeAuthority = await resolveFinanceDepartmentIds(
        body.financeDepartmentIds,
        role.name,
        currentUser.organizationId,
        currentUser.financeDepartmentIds,
      );
      if ("error" in financeAuthority) {
        return apiError(422, financeAuthority.error, "VALIDATION_ERROR", {
          fieldErrors: { financeDepartmentIds: financeAuthority.error },
        });
      }

      if (currentUser.id === authorization.principal.userId) {
        if (role.id !== currentUser.roleId) return apiError(409, "You cannot change your own role.", "SELF_MODIFICATION");
        if (body.status === "inactive") return apiError(409, "You cannot deactivate your own account.", "SELF_MODIFICATION");
      }

      if (role.name.toLowerCase() === "manager" && (body.status ?? currentUser.status) !== "inactive") {
        const conflict = await teamManagerConflict(team.id, currentUser.id);
        if (conflict) return conflict;
      }

      const usersForAdminGuard = await listRecords<MockUser>("users");
      if (currentUser.role === "admin" && (role.name !== "admin" || body.status === "inactive") && !usersForAdminGuard.some((item) => item.id !== currentUser.id && item.organizationId === currentUser.organizationId && item.role === "admin" && item.status === "active")) {
        return apiError(409, "The final active Admin cannot be deactivated or reassigned without a replacement Admin.");
      }

      const { financeDepartmentIds: _previousFinanceDepartmentIds, ...currentUserFields } = currentUser;
      const updatedUser: MockUser = {
        ...currentUserFields,
        name: body.name.trim(),
        email,
        role: role.name,
        roleId: role.id,
        departmentId: department.id,
        teamId: team.id,
        permissions: role.permissions,
        status: body.status ?? currentUser.status ?? "active",
        ...(financeAuthority.ids ? { financeDepartmentIds: financeAuthority.ids } : {}),
      };

      const credential = await getRecord<MockCredential>(
        "credentials",
        userId,
      );
      const password = body.password
        ? await hashPassword(body.password)
        : credential?.password;

      await runAuditedTransaction(
        ["users", "credentials"],
        {
          organizationId: updatedUser.organizationId,
          actorId: authorization.principal.userId,
          action: "USER_UPDATED",
          entityType: "USER",
          entityId: updatedUser.id,
          metadata: {
            previousRoleId: currentUser.roleId,
            newRoleId: updatedUser.roleId,
            previousPermissions: currentUser.permissions,
            newPermissions: updatedUser.permissions,
            previousFinanceDepartmentIds: currentUser.financeDepartmentIds,
            newFinanceDepartmentIds: updatedUser.financeDepartmentIds,
          },
          description: `Updated user ${updatedUser.name}.`,
        },
        (transaction) => {
          transaction.objectStore("users").put(updatedUser);
          if (credential) {
            transaction.objectStore("credentials").put({
              ...credential,
              email,
              password: password ?? credential.password,
            });
          }
        },
      );

      return HttpResponse.json(updatedUser);
    },
  ),

  http.patch(`${API_BASE_URL}/users/:id/status`, async ({ params, request }) => {
    const userId = String(params.id);
    const user = await getRecord<MockUser>("users", userId);
    if (!user || user.status === "deleted") return apiError(404, "User not found.");
    const authorization = await authorizeRequest(request, { permission: "users.update", scope: "ORGANIZATION", resource: { organizationId: user.organizationId } });
    if (!authorization.allowed) return authorizationError(authorization);
    const body = (await request.json()) as { status?: "active" | "inactive" };
    if (body.status !== "active" && body.status !== "inactive") return apiError(422, "Status must be Active or Inactive.");
    if (user.id === authorization.principal.userId && body.status === "inactive") {
      return apiError(409, "You cannot deactivate your own account.", "SELF_MODIFICATION");
    }
    if (user.role === "admin" && user.status !== "inactive" && body.status === "inactive") {
      const activeAdmins = (await listRecords<MockUser>("users")).filter((item) => item.organizationId === user.organizationId && item.role === "admin" && item.status === "active");
      if (activeAdmins.length <= 1) return apiError(409, "The final active Admin cannot be deactivated.");
    }
    if (body.status === "active" && user.status === "inactive" && user.role.toLowerCase() === "manager") {
      const conflict = await teamManagerConflict(user.teamId, user.id);
      if (conflict) return conflict;
    }
    const updated = { ...user, status: body.status, updatedAt: new Date().toISOString() };
    await runAuditedTransaction(["users"], { organizationId: user.organizationId, actorId: authorization.principal.userId, action: body.status === "inactive" ? "USER_DEACTIVATED" : "USER_UPDATED", entityType: "USER", entityId: user.id, previousState: user.status, newState: updated.status, description: `Changed user ${user.name} status to ${updated.status}.` }, (transaction) => transaction.objectStore("users").put(updated));
    return HttpResponse.json(updated);
  }),

  http.delete(`${API_BASE_URL}/users/:id`, async ({ params, request }) => {
    const userId = String(params.id);
    const user = await getRecord<MockUser>("users", userId);

    if (!user) {
      return apiError(404, "User not found.");
    }

    const authorization = await authorizeRequest(request, {
      permission: "users.delete",
      scope: "ORGANIZATION",
      resource: { organizationId: user.organizationId },
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }

    if (user.status === "deleted") {
      return apiError(404, "User not found.");
    }

    if (user.id === authorization.principal.userId) {
      return apiError(409, "You cannot delete your own account.", "SELF_MODIFICATION");
    }

    if (user.role === "admin" && user.status === "active") {
      const activeAdmins = (await listRecords<MockUser>("users")).filter((item) => item.organizationId === user.organizationId && item.role === "admin" && item.status === "active");
      if (activeAdmins.length <= 1) {
        return apiError(409, "The final active Admin cannot be deleted.");
      }
    }

    // §27.3: a user with expense history is removed rather than erased, so
    // their expenses stay attributable. They leave their team and department,
    // lose access, and their private drafts are cancelled; submitted work
    // continues through the normal workflow.
    const ownedExpenses = await listRecordsByIndex<{ id: string; status: string; title: string; [key: string]: unknown }>("expenses", "employeeId", user.id);
    if (ownedExpenses.length > 0) {
      const now = new Date().toISOString();
      const { teamId: _teamId, departmentId: _departmentId, financeDepartmentIds: _finance, ...rest } = user;
      const removedUser = { ...rest, status: "deleted" as const, deletedAt: now, updatedAt: now };
      const cancelledDrafts = ownedExpenses
        .filter((expense) => expense.status === "draft")
        .map((expense) => ({
          ...expense,
          status: "cancelled",
          cancelledAt: now,
          cancelledBy: authorization.principal.userId,
          cancellationReason: "The owner was removed from the organization.",
          updatedAt: now,
        }));
      const activeSessions = (await listRecords<{ id: string; userId: string; status: string }>("sessions"))
        .filter((session) => session.userId === user.id && session.status === "active");

      await runAuditedTransaction(
        ["users", "credentials", "expenses", "sessions"],
        {
          organizationId: user.organizationId,
          actorId: authorization.principal.userId,
          action: "USER_DELETED",
          entityType: "USER",
          entityId: user.id,
          previousState: user.status,
          newState: "deleted",
          metadata: {
            previousTeamId: user.teamId,
            previousDepartmentId: user.departmentId,
            retainedExpenseCount: ownedExpenses.length,
            cancelledDraftIds: cancelledDrafts.map((expense) => expense.id),
          },
          description: `Removed user ${user.name}; their expense history was retained.`,
        },
        (transaction) => {
          transaction.objectStore("users").put(removedUser);
          transaction.objectStore("credentials").delete(userId);
          for (const expense of cancelledDrafts) transaction.objectStore("expenses").put(expense);
          for (const session of activeSessions) {
            transaction.objectStore("sessions").put({ ...session, status: "revoked", revokedAt: now });
          }
        },
      );

      return new HttpResponse(null, { status: 204 });
    }

    await runAuditedTransaction(
      ["users", "credentials"],
      {
        organizationId: user.organizationId,
        actorId: authorization.principal.userId,
        action: "USER_DELETED",
        entityType: "USER",
        entityId: user.id,
        previousState: user.status,
        newState: "deleted",
        description: `Deleted user ${user.name}.`,
      },
      (transaction) => {
        transaction.objectStore("users").delete(userId);
        transaction.objectStore("credentials").delete(userId);
      },
    );

    return new HttpResponse(null, { status: 204 });
  }),
];
