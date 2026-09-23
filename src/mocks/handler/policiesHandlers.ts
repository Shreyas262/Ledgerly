import { http, HttpResponse } from "msw";

import {
  authorizeCollection,
  authorizeRequest,
} from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";

import {
  getRecord,
  listRecords,
  saveRecord,
} from "../services/mockDataService";

interface MockPolicy {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  approvalLimit: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export const policiesHandlers = [
  http.get("/api/policies", async ({ request }) => {
    const result = await authorizeCollection(
      request,
      await listRecords<MockPolicy>("policies"),
      {
        permission: "policies.read",
        scope: "ORGANIZATION",
        getResource: (policy) => ({ organizationId: policy.organizationId }),
      },
    );

    if (!result.allowed) {
      return authorizationError(result);
    }

    return HttpResponse.json(result.records);
  }),

  http.get("/api/policies/:id", async ({ params, request }) => {
    const policy = await getRecord<MockPolicy>(
      "policies",
      String(params.id),
    );

    if (!policy) {
      return HttpResponse.json(
        { message: "Policy not found." },
        { status: 404 },
      );
    }

    const authorization = await authorizeRequest(request, {
      permission: "policies.read",
      scope: "ORGANIZATION",
      resource: { organizationId: policy.organizationId },
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }

    return HttpResponse.json(policy);
  }),

  http.post("/api/policies", async ({ request }) => {
    const authorization = await authorizeRequest(request, {
      permission: "policies.create",
      scope: "ORGANIZATION",
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }
    const body = (await request.json()) as {
      name: string;
      description?: string;
      approvalLimit: number;
      status: string;
    };

    const now = new Date().toISOString();

    const newPolicy: MockPolicy = {
      id: crypto.randomUUID(),
      organizationId: authorization.principal.organizationId,
      name: body.name,
      description: body.description,
      approvalLimit: body.approvalLimit,
      status: body.status,
      createdAt: now,
      updatedAt: now,
    };

    await saveRecord("policies", newPolicy);

    return HttpResponse.json(newPolicy, { status: 201 });
  }),

  http.put(
    "/api/policies/:id",
    async ({ params, request }) => {
      const policyId = String(params.id);
      const existingPolicy = await getRecord<MockPolicy>(
        "policies",
        policyId,
      );

      if (!existingPolicy) {
        return HttpResponse.json(
          { message: "Policy not found." },
          { status: 404 },
        );
      }

      const authorization = await authorizeRequest(request, {
        permission: "policies.update",
        scope: "ORGANIZATION",
        resource: { organizationId: existingPolicy.organizationId },
      });

      if (!authorization.allowed) {
        return authorizationError(authorization);
      }

      const body = (await request.json()) as {
        name: string;
        description?: string;
        approvalLimit: number;
        status: string;
      };

      const updatedPolicy: MockPolicy = {
        ...existingPolicy,
        name: body.name,
        description: body.description,
        approvalLimit: body.approvalLimit,
        status: body.status,
        updatedAt: new Date().toISOString(),
      };

      await saveRecord("policies", updatedPolicy);

      return HttpResponse.json(updatedPolicy);
    },
  ),
];
