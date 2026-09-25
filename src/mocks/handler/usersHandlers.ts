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
  status: "active" | "inactive";
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
    return { error: "Authorized departments must be a list of departments." };
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
    const records = result.records.map((user) => ({
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
      return apiError(422, "User validation failed.", "VALIDATION_ERROR", { fieldErrors });
    }

    const email = body.email.trim();
    const users = await listRecords<MockUser>("users");

    if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      return apiError(409, "A user with this email already exists.");
    }

    const role = body.roleId
      ? await getRecord<{ id: string; organizationId: string; name: string; permissions: string[] }>("roles", body.roleId)
      : (await listRecords<{ id: string; organizationId: string; name: string; permissions: string[] }>("roles")).find((item) => item.organizationId === authorization.principal.organizationId && item.name === body.role);
    const department = await getRecord<{ id: string; organizationId: string; status?: string }>("departments", body.departmentId!);
    const team = await getRecord<{ id: string; organizationId: string; departmentId: string; status?: string }>("teams", body.teamId!);
    if (!role || role.organizationId !== authorization.principal.organizationId || !department || department.organizationId !== authorization.principal.organizationId || !team || team.organizationId !== authorization.principal.organizationId || team.departmentId !== department.id || department.status === "inactive" || team.status === "inactive") {
      return apiError(422, "Invalid role, department, or team assignment.");
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

      if (!currentUser) {
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
      if (body.password !== undefined && typeof body.password !== "string") fieldErrors.password = "Password must be a string.";
      if (Object.keys(fieldErrors).length) {
        return apiError(422, "User validation failed.", "VALIDATION_ERROR", { fieldErrors });
      }

      const email = body.email.trim();
      const users = await listRecords<MockUser>("users");

      if (
        users.some(
          (user) =>
            user.id !== userId &&
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
        return apiError(422, "Invalid role, department, or team assignment.");
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

      const usersForAdminGuard = await listRecords<MockUser>("users");
      if (currentUser.role === "admin" && (role.name !== "admin" || body.status === "inactive") && !usersForAdminGuard.some((item) => item.id !== currentUser.id && item.organizationId === currentUser.organizationId && item.role === "admin" && item.status !== "inactive")) {
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
    if (!user) return apiError(404, "User not found.");
    const authorization = await authorizeRequest(request, { permission: "users.update", scope: "ORGANIZATION", resource: { organizationId: user.organizationId } });
    if (!authorization.allowed) return authorizationError(authorization);
    const body = (await request.json()) as { status?: "active" | "inactive" };
    if (body.status !== "active" && body.status !== "inactive") return apiError(422, "Invalid status.");
    if (user.role === "admin" && user.status !== "inactive" && body.status === "inactive") {
      const activeAdmins = (await listRecords<MockUser>("users")).filter((item) => item.organizationId === user.organizationId && item.role === "admin" && item.status !== "inactive");
      if (activeAdmins.length <= 1) return apiError(409, "The final active Admin cannot be deactivated.");
    }
    const updated = { ...user, status: body.status, updatedAt: new Date().toISOString() };
    await runAuditedTransaction(["users"], { organizationId: user.organizationId, actorId: authorization.principal.userId, action: body.status === "inactive" ? "USER_DEACTIVATED" : "USER_UPDATED", entityType: "USER", entityId: user.id, previousState: user.status, newState: updated.status, description: `Changed user ${user.name} status to ${updated.status}.` }, (transaction) => transaction.objectStore("users").put(updated));
    return HttpResponse.json(updated);
  }),

  http.delete(`${API_BASE_URL}/users/:id`, async ({ params, request }) => {
    const userId = String(params.id);
    const user = await getRecord<MockUser>("users", userId);

    if (!user) {
      return apiError(404, "Resource not found.");
    }

    const authorization = await authorizeRequest(request, {
      permission: "users.delete",
      scope: "ORGANIZATION",
      resource: { organizationId: user.organizationId },
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }

    if (user.role === "admin" && user.status !== "inactive") {
      const activeAdmins = (await listRecords<MockUser>("users")).filter((item) => item.organizationId === user.organizationId && item.role === "admin" && item.status !== "inactive");
      if (activeAdmins.length <= 1) {
        return apiError(409, "The final active Admin cannot be deleted.");
      }
    }

    // §27.3/§27.8: historical business records must stay attributable.
    const ownedExpenses = await listRecordsByIndex<{ id: string }>("expenses", "employeeId", user.id);
    if (ownedExpenses.length > 0) {
      return apiError(409, "This user owns expense records and cannot be deleted. Deactivate the user instead.", "USER_HAS_RECORDS");
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
