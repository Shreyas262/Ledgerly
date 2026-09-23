import { http, HttpResponse } from "msw";

import {
  authorizeCollection,
  authorizeRequest,
} from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";

import {
  deleteRecord,
  getRecord,
  listRecords,
  saveRecord,
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

    return HttpResponse.json(result.records);
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

    const newRole: MockRole = {
      id: crypto.randomUUID(),
      organizationId: authorization.principal.organizationId,
      name: body.name,
      permissions: body.permissions,
      description: body.description,
      isSystemRole: body.isSystemRole ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await saveRecord("roles", newRole);

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
        return new HttpResponse(null, { status: 404 });
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

      const updatedRole: MockRole = {
        ...existingRole,
        ...body,
        id: existingRole.id,
        organizationId: existingRole.organizationId,
        updatedAt: new Date().toISOString(),
      };

      await saveRecord("roles", updatedRole);

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
      return new HttpResponse(null, { status: 404 });
    }

    const authorization = await authorizeRequest(request, {
      permission: "roles.delete",
      scope: "ORGANIZATION",
      resource: { organizationId: existingRole.organizationId },
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }

    await deleteRecord("roles", roleId);

    return new HttpResponse(null, { status: 204 });
  }),
];
