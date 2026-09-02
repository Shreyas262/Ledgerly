import { http, HttpResponse } from "msw";
import { credentials } from "../data/credentials";

import type {
  CreateUserPayload,
  UpdateUserPayload,
  User,
} from "../../types/auth";

import { users } from "../data/users";

const API_BASE_URL = "/api"

export const usersHandlers = [
  http.get(`${API_BASE_URL}/users`, () => {
    return HttpResponse.json(users);
  }),

  http.post(`${API_BASE_URL}/users`, async ({ request }) => {
    const body = (await request.json()) as CreateUserPayload;

    const existingUser = users.find(
      (user) => user.email === body.email,
    );

    if (existingUser) {
      return HttpResponse.json(
        {
          message: "A user with this email already exists.",
        },
        {
          status: 409,
        },
      );
    }
    
    const newUser: User = {
      id: crypto.randomUUID(),
      organizationId: body.organizationId,
      name: body.name,
      email: body.email,
      role: body.role,
      permissions: body.permissions,
    };

    users.push(newUser);

    credentials.push({
      userId: newUser.id,
      email: body.email,
      password: body.password,
    });

    return HttpResponse.json(newUser, {
      status: 201,
    });
  }),

  http.put(`${API_BASE_URL}/users/:id`, async ({ params, request }) => {
    const userId = String(params.id);

    const body = (await request.json()) as UpdateUserPayload;

    const userIndex = users.findIndex(
      (user) => user.id === userId,
    );

    if (userIndex === -1) {
      return HttpResponse.json(
        {
          message: "User not found.",
        },
        {
          status: 404,
        },
      );
    }

    const currentUser = users[userIndex];
    const emailAlreadyExists = users.some(
      (user) =>
        user.id !== userId &&
        user.email === body.email,
    );

    if (emailAlreadyExists) {
      return HttpResponse.json(
        {
          message: "A user with this email already exists.",
        },
        {
          status: 409,
        },
      );
    }

    const updatedUser: User = {
      ...currentUser,
      name: body.name,
      email: body.email,
      role: body.role,
      permissions: body.permissions,
    };

    users[userIndex] = updatedUser;
  
    const credentialIndex = credentials.findIndex(
      (credential) =>
        credential.userId === userId,
    );

    if (credentialIndex !== -1) {
      credentials[credentialIndex].email = body.email;
      if (body.password) {
        credentials[credentialIndex].password =
          body.password;
      }
    }

    return HttpResponse.json(updatedUser);
    }),


  http.delete(`${API_BASE_URL}/users/:id`, ({ params }) => {
    const userIndex = users.findIndex(
      (user) => user.id === params.id,
    );

    if (userIndex === -1) {
      return new HttpResponse(null, {
        status: 404,
      });
    }

    users.splice(userIndex, 1);

    return new HttpResponse(null, {
      status: 204,
    });
  }),
  http.delete(`${API_BASE_URL}/users/:id`,
    ({ params }) => {
      const userId = String(params.id);

      const userIndex = users.findIndex(
        (user) => user.id === userId,
      );

      if (userIndex === -1) {
        return HttpResponse.json(
          {
            message: "User not found.",
          },
          {
            status: 404,
          },
        );
      }

      users.splice(userIndex, 1);

      const credentialIndex =
        credentials.findIndex(
          (credential) =>
            credential.userId === userId,
        );

      if (credentialIndex !== -1) {
        credentials.splice(credentialIndex, 1);
      }

      return new HttpResponse(null, {
        status: 204,
      });
    },
  ),
];