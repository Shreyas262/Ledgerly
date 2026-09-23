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

    return HttpResponse.json(result.records);
  }),

  http.post(`${API_BASE_URL}/users`, async ({ request }) => {
    const authorization = await authorizeRequest(request, {
      permission: "users.create",
      scope: "ORGANIZATION",
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }
    const body = (await request.json()) as {
      organizationId: string;
      departmentId?: string;
      teamId?: string;
      roleId?: string;
      name: string;
      email: string;
      role: string;
      permissions: string[];
      password: string;
    };

    const users = await listRecords<MockUser>("users");

    if (users.some((user) => user.email === body.email)) {
      return HttpResponse.json(
        {
          message: "A user with this email already exists.",
        },
        { status: 409 },
      );
    }

    const newUser: MockUser = {
      id: crypto.randomUUID(),
      organizationId: authorization.principal.organizationId,
      departmentId: body.departmentId ?? "dept-operations",
      teamId: body.teamId ?? "team-operations",
      roleId: body.roleId ?? `role-${body.role}`,
      name: body.name,
      email: body.email,
      role: body.role,
      permissions: body.permissions,
    };

    await saveRecord("users", newUser);

    await saveRecord<MockCredential>("credentials", {
      userId: newUser.id,
      email: body.email,
      password: body.password,
    });

    return HttpResponse.json(newUser, { status: 201 });
  }),

  http.put(
    `${API_BASE_URL}/users/:id`,
    async ({ params, request }) => {
      const userId = String(params.id);
      const body = (await request.json()) as {
        name: string;
        email: string;
        role: string;
        permissions: string[];
        departmentId?: string;
        teamId?: string;
        roleId?: string;
        password?: string;
      };

      const currentUser = await getRecord<MockUser>(
        "users",
        userId,
      );

      if (!currentUser) {
        return HttpResponse.json(
          { message: "User not found." },
          { status: 404 },
        );
      }

      const authorization = await authorizeRequest(request, {
        permission: "users.update",
        scope: "ORGANIZATION",
        resource: { organizationId: currentUser.organizationId },
      });

      if (!authorization.allowed) {
        return authorizationError(authorization);
      }

      const users = await listRecords<MockUser>("users");

      if (
        users.some(
          (user) =>
            user.id !== userId &&
            user.email === body.email,
        )
      ) {
        return HttpResponse.json(
          {
            message: "A user with this email already exists.",
          },
          { status: 409 },
        );
      }

      const updatedUser: MockUser = {
        ...currentUser,
        name: body.name,
        email: body.email,
        role: body.role,
        roleId: body.roleId ?? currentUser.roleId ?? `role-${body.role}`,
        departmentId: body.departmentId ?? currentUser.departmentId,
        teamId: body.teamId ?? currentUser.teamId,
        permissions: body.permissions,
      };

      await saveRecord("users", updatedUser);

      const credential = await getRecord<MockCredential>(
        "credentials",
        userId,
      );

      if (credential) {
        await saveRecord("credentials", {
          ...credential,
          email: body.email,
          password: body.password ?? credential.password,
        });
      }

      return HttpResponse.json(updatedUser);
    },
  ),

  http.delete(`${API_BASE_URL}/users/:id`, async ({ params, request }) => {
    const userId = String(params.id);
    const user = await getRecord<MockUser>("users", userId);

    if (!user) {
      return new HttpResponse(null, { status: 404 });
    }

    const authorization = await authorizeRequest(request, {
      permission: "users.delete",
      scope: "ORGANIZATION",
      resource: { organizationId: user.organizationId },
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }

    await deleteRecord("users", userId);
    await deleteRecord("credentials", userId);

    return new HttpResponse(null, { status: 204 });
  }),
];
