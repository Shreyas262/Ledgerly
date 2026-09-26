import { apiError } from "../services/apiError";
import { applyCollectionQuery, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";

import {
  authorizeCollection,
  authorizeRequest,
} from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { runAuditedTransaction } from "../services/auditService";
import { allPermissions } from "../../features/roles/constants/permissions";

import {
  getRecord,
  listRecords,
} from "../services/mockDataService";

interface MockRole {
  id: string;
  organizationId: string;
  name: string;
  permissions: string[];
  isSystemRole?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface CreateRoleBody {
  name: string;
  permissions: string[];
  description?: string;
  isSystemRole?: boolean;
}

const API_BASE_URL = "/api";

export const roleHandlers = [
  http.get(`${API_BASE_URL}/roles`, async ({ request }) => {
    const result = await authorizeCollection(
      request,
      await listRecords<MockRole>("roles"),
      {
        permission: "roles.read",
        scope: "ORGANIZATION",
        getResource: (role) => ({ organizationId: role.organizationId }),
      },
    );

    if (!result.allowed) {
      return authorizationError(result);
    }

    // Number of current (non-removed) users holding each role.
    const users = await listRecords<{ roleId: string; status?: string }>("users");
    const withCounts = result.records.map((role) => ({
      ...role,
      userCount: users.filter((user) => user.roleId === role.id && user.status !== "deleted").length,
    }));
    return HttpResponse.json(applyCollectionQuery(withCounts, parseCollectionQuery(request)));
  }),

  http.post(`${API_BASE_URL}/roles`, async ({ request }) => {
    const authorization = await authorizeRequest(request, {
      permission: "roles.create",
      scope: "ORGANIZATION",
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }

    const body = (await request.json()) as CreateRoleBody;
    const now = new Date().toISOString();

    if (!body.name.trim() || body.permissions.some((permission) => !allPermissions.includes(permission as (typeof allPermissions)[number]))) {
      return apiError(400, "Invalid role or permission assignment.");
    }

    const existingRoles = await listRecords<MockRole>("roles");
    if (existingRoles.some((role) => role.organizationId === authorization.principal.organizationId && role.name.toLowerCase() === body.name.trim().toLowerCase())) {
      return apiError(409, "A role with this name already exists.");
    }

    const newRole: MockRole = {
      id: crypto.randomUUID(),
      organizationId: authorization.principal.organizationId,
      name: body.name.trim(),
      permissions: body.permissions,
      description: body.description,
      isSystemRole: body.isSystemRole ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await runAuditedTransaction(
      ["roles"],
      {
        organizationId: newRole.organizationId,
        actorId: authorization.principal.userId,
        action: "ROLE_CREATED",
        entityType: "ROLE",
        entityId: newRole.id,
        newState: "active",
        metadata: { permissions: newRole.permissions },
        description: `Created role ${newRole.name}.`,
      },
      (transaction) => {
        transaction.objectStore("roles").put(newRole);
      },
    );

    return HttpResponse.json(newRole, { status: 201 });
  }),

  http.put(
    `${API_BASE_URL}/roles/:id`,
    async ({ params, request }) => {
      const roleId = String(params.id);
      const existingRole = await getRecord<MockRole>(
        "roles",
        roleId,
      );

      if (!existingRole) {
        return apiError(404, "Resource not found.");
      }

      const authorization = await authorizeRequest(request, {
        permission: "roles.update",
        scope: "ORGANIZATION",
        resource: { organizationId: existingRole.organizationId },
      });

      if (!authorization.allowed) {
        return authorizationError(authorization);
      }

      const body = (await request.json()) as Partial<CreateRoleBody>;
      const permissions = body.permissions ?? existingRole.permissions;
      const name = body.name?.trim() ?? existingRole.name;

      if (!name || permissions.some((permission) => !allPermissions.includes(permission as (typeof allPermissions)[number]))) {
        return apiError(400, "Invalid role or permission assignment.");
      }

      const roles = await listRecords<MockRole>("roles");
      if (roles.some((role) => role.id !== existingRole.id && role.organizationId === existingRole.organizationId && role.name.toLowerCase() === name.toLowerCase())) {
        return apiError(409, "A role with this name already exists.");
      }

      const users = await listRecords<{ roleId: string; status?: string; organizationId: string }>("users");
      if (existingRole.name === "admin" && name === "admin") {
        const required = ["users.read", "users.update", "roles.read", "roles.update", "organization.read", "organization.manage"];
        if (required.some((permission) => !permissions.includes(permission))) {
          return apiError(409, "The Admin role must retain the permissions required for continued administration.");
        }
      }
      if (existingRole.name === "admin" && name !== "admin" && !users.some((user) => user.organizationId === existingRole.organizationId && user.status !== "inactive" && user.roleId !== existingRole.id && user.roleId === "role-admin")) {
        return apiError(409, "The final Admin role cannot be renamed without another active Admin.");
      }

      const updatedRole: MockRole = {
        ...existingRole,
        ...body,
        name,
        permissions,
        id: existingRole.id,
        organizationId: existingRole.organizationId,
        updatedAt: new Date().toISOString(),
      };

      const action =
        JSON.stringify(existingRole.permissions) === JSON.stringify(updatedRole.permissions)
          ? "ROLE_UPDATED"
          : "ROLE_PERMISSIONS_UPDATED";

      await runAuditedTransaction(
        ["roles"],
        {
          organizationId: updatedRole.organizationId,
          actorId: authorization.principal.userId,
          action,
          entityType: "ROLE",
          entityId: updatedRole.id,
          metadata: {
            previousPermissions: existingRole.permissions,
            newPermissions: updatedRole.permissions,
          },
          description: `Updated role ${updatedRole.name}.`,
        },
        (transaction) => {
          transaction.objectStore("roles").put(updatedRole);
        },
      );

      return HttpResponse.json(updatedRole);
    },
  ),

  http.delete(`${API_BASE_URL}/roles/:id`, async ({ params, request }) => {
    const roleId = String(params.id);
    const existingRole = await getRecord<MockRole>(
      "roles",
      roleId,
    );

    if (!existingRole) {
      return apiError(404, "Resource not found.");
    }

    const authorization = await authorizeRequest(request, {
      permission: "roles.delete",
      scope: "ORGANIZATION",
      resource: { organizationId: existingRole.organizationId },
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }

    // Removed users keep their role name on record, so only current users block deletion.
    const assignedUsers = await listRecords<{ roleId: string; organizationId: string; status?: string }>("users");
    if (assignedUsers.some((user) => user.organizationId === existingRole.organizationId && user.roleId === existingRole.id && user.status !== "deleted")) {
      return apiError(409, "Role cannot be deleted while it is assigned to users.");
    }

    await runAuditedTransaction(
      ["roles"],
      {
        organizationId: existingRole.organizationId,
        actorId: authorization.principal.userId,
        action: "ROLE_DELETED",
        entityType: "ROLE",
        entityId: existingRole.id,
        previousState: "active",
        newState: "deleted",
        description: `Deleted role ${existingRole.name}.`,
      },
      (transaction) => {
        transaction.objectStore("roles").delete(roleId);
      },
    );

    return new HttpResponse(null, { status: 204 });
  }),
];
