import { http, HttpResponse } from "msw";

import type { CreateRolePayload, Role, UpdateRolePayload } from "../../types/auth"; 
import { roles } from "../data/roles";

const API_BASE_URL = "/api";

export const roleHandlers = [
  http.get(`${API_BASE_URL}/roles`, () => {
    return HttpResponse.json(roles);
  }),
  
  http.post(`${API_BASE_URL}/roles`, async ({ request }) => {
    const body = (await request.json()) as CreateRolePayload;

    const newRole: Role = {
      id: crypto.randomUUID(),
      ...body,
    };

    roles.push(newRole);

    return HttpResponse.json(newRole, {
      status: 201,
    });
  }),

  http.put(`${API_BASE_URL}/roles/:id`, async ({ params, request }) => {
    const roleIndex = roles.findIndex(
      (role) => role.id === params.id
    );

    if (roleIndex === -1) {
      return new HttpResponse(null, {
        status: 404,
      });
    }

    const body = (await request.json()) as UpdateRolePayload;

    const updatedRole: Role = {
      ...roles[roleIndex],
      ...body,
    };

    roles[roleIndex] = updatedRole;

    return HttpResponse.json(updatedRole, {
      status: 200,
    });
  }),

  http.delete(`${API_BASE_URL}/roles/:id`, ({ params }) => {
    const roleIndex = roles.findIndex(
      (role) => role.id === params.id
    );

    if (roleIndex === -1) {
      return new HttpResponse(null, {
        status: 404,
      });
    }

    roles.splice(roleIndex, 1);

    return new HttpResponse(null, {
      status: 204,
    });
  }),
];