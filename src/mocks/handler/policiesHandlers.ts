import { http, HttpResponse } from "msw";

import { policies } from "../data/policies";

import type {
  CreateExpensePolicyRequest,
  ExpensePolicy,
  UpdateExpensePolicyRequest,
} from "../../types/policy";

export const policiesHandlers = [
  http.get("/api/policies", () => {
    return HttpResponse.json(policies);
  }),

  http.get("/api/policies/:id", ({ params }) => {
    const policyId = String(params.id);

    const policy = policies.find(
      (item) => item.id === policyId,
    );

    if (!policy) {
      return HttpResponse.json(
        {
          message: "Policy not found.",
        },
        {
          status: 404,
        },
      );
    }

    return HttpResponse.json(policy);
  }),

  http.post(
    "/api/policies",
    async ({ request }) => {
      const body =
        (await request.json()) as CreateExpensePolicyRequest;

      const now = new Date().toISOString();

      const newPolicy: ExpensePolicy = {
        id: crypto.randomUUID(),
        organizationId: "org-001",
        name: body.name,
        description: body.description,
        approvalLimit: body.approvalLimit,
        status: body.status,
        createdAt: now,
        updatedAt: now,
      };

      policies.push(newPolicy);

      return HttpResponse.json(newPolicy, {
        status: 201,
      });
    },
  ),

  http.put(
    "/api/policies/:id",
    async ({ params, request }) => {
      const policyId = String(params.id);

      const policyIndex = policies.findIndex(
        (item) => item.id === policyId,
      );

      if (policyIndex === -1) {
        return HttpResponse.json(
          {
            message: "Policy not found.",
          },
          {
            status: 404,
          },
        );
      }

      const body =
        (await request.json()) as Omit<
          UpdateExpensePolicyRequest,
          "id"
        >;

      const existingPolicy = policies[policyIndex];

      const updatedPolicy: ExpensePolicy = {
        ...existingPolicy,
        name: body.name,
        description: body.description,
        approvalLimit: body.approvalLimit,
        status: body.status,
        updatedAt: new Date().toISOString(),
      };

      policies[policyIndex] = updatedPolicy;

      return HttpResponse.json(updatedPolicy);
    },
  ),
];