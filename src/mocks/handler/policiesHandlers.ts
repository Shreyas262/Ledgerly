import { applyCollectionQuery, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";
import { apiError } from "../services/apiError";

import {
  authorizeCollection,
  authorizeRequest,
} from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { runAuditedTransaction } from "../services/auditService";

import {
  getRecord,
  listRecords,
} from "../services/mockDataService";

interface MockPolicy {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  expenseType?: string;
  approvalLimit: number;
  rule?: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

const EXPENSE_TYPES = new Set<string>([
  "MEALS",
  "TRAVEL",
  "ACCOMMODATION",
  "TRANSPORTATION",
  "ENTERTAINMENT",
  "OFFICE_SUPPLIES",
  "COMMUNICATION",
  "TRAINING",
  "OTHER",
]);
const POLICY_STATUSES = new Set(["draft", "active", "inactive"]);

interface PolicyInput {
  name: string;
  description?: string;
  expenseType?: string;
  approvalLimit: number;
  rule?: Record<string, unknown>;
  status: string;
}

function isPositiveAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validatePolicyBody(body: unknown): PolicyInput | { fieldErrors: Record<string, string> } {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const fieldErrors: Record<string, string> = {};
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const rule = value.rule && typeof value.rule === "object" ? (value.rule as Record<string, unknown>) : undefined;

  if (!name) fieldErrors.name = "Policy name is required.";
  if (!isPositiveAmount(value.approvalLimit)) fieldErrors.approvalLimit = "Approval limit must be greater than 0.";
  if (value.expenseType !== undefined && (typeof value.expenseType !== "string" || !EXPENSE_TYPES.has(value.expenseType))) {
    fieldErrors.expenseType = "A valid expense type is required.";
  }
  if (typeof value.status !== "string" || !POLICY_STATUSES.has(value.status)) fieldErrors.status = "A valid policy status is required.";
  if (rule?.approvalThreshold !== undefined && !isPositiveAmount(rule.approvalThreshold)) {
    fieldErrors.approvalThreshold = "Approval threshold must be greater than 0.";
  }
  if (rule?.maximumAmount !== undefined && !isPositiveAmount(rule.maximumAmount)) {
    fieldErrors.maximumAmount = "Maximum amount must be greater than 0.";
  }
  if (rule?.requiresReceipt !== undefined && typeof rule.requiresReceipt !== "boolean") {
    fieldErrors.requiresReceipt = "Receipt requirement must be true or false.";
  }

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  return {
    name,
    description: typeof value.description === "string" && value.description.trim() ? value.description.trim() : undefined,
    expenseType: value.expenseType as string | undefined,
    approvalLimit: value.approvalLimit as number,
    rule,
    status: value.status as string,
  };
}

/**
 * §21.8: at most one active policy may apply per organization and expense
 * type (a policy without an expense type is the organization-wide scope).
 */
async function findConflictingActivePolicy(
  organizationId: string,
  expenseType: string | undefined,
  excludePolicyId?: string,
): Promise<MockPolicy | undefined> {
  const policies = await listRecords<MockPolicy>("policies");
  return policies.find(
    (policy) =>
      policy.id !== excludePolicyId &&
      policy.organizationId === organizationId &&
      policy.status === "active" &&
      (policy.expenseType ?? null) === (expenseType ?? null),
  );
}

function policyConflict(conflicting: MockPolicy) {
  return apiError(
    409,
    `An active policy ("${conflicting.name}") already applies to this expense type. Deactivate it first.`,
    "POLICY_CONFLICT",
    { conflictingResource: { id: conflicting.id, name: conflicting.name } },
  );
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

    return HttpResponse.json(applyCollectionQuery(result.records, parseCollectionQuery(request)));
  }),

  http.get("/api/policies/:id", async ({ params, request }) => {
    const policy = await getRecord<MockPolicy>(
      "policies",
      String(params.id),
    );

    if (!policy) {
      return apiError(404, "Policy not found.");
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
    const body = validatePolicyBody(await request.json().catch(() => ({})));
    if ("fieldErrors" in body) {
      return apiError(422, "Policy validation failed.", "VALIDATION_ERROR", { fieldErrors: body.fieldErrors });
    }

    if (body.status === "active") {
      const conflicting = await findConflictingActivePolicy(
        authorization.principal.organizationId,
        body.expenseType,
      );
      if (conflicting) return policyConflict(conflicting);
    }

    const now = new Date().toISOString();

    const newPolicy: MockPolicy = {
      id: crypto.randomUUID(),
      organizationId: authorization.principal.organizationId,
      name: body.name,
      description: body.description,
      expenseType: body.expenseType,
      approvalLimit: body.approvalLimit,
      rule: body.rule,
      status: body.status,
      createdBy: authorization.principal.userId,
      createdAt: now,
      updatedAt: now,
    };

    await runAuditedTransaction(
      ["policies"],
      {
        organizationId: newPolicy.organizationId,
        actorId: authorization.principal.userId,
        action: "POLICY_CREATED",
        entityType: "POLICY",
        entityId: newPolicy.id,
        newState: newPolicy.status,
        description: `Created policy ${newPolicy.name}.`,
      },
      (transaction) => {
        transaction.objectStore("policies").put(newPolicy);
      },
    );

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
        return apiError(404, "Policy not found.");
      }

      const authorization = await authorizeRequest(request, {
        permission: "policies.update",
        scope: "ORGANIZATION",
        resource: { organizationId: existingPolicy.organizationId },
      });

      if (!authorization.allowed) {
        return authorizationError(authorization);
      }

      const body = validatePolicyBody(await request.json().catch(() => ({})));
      if ("fieldErrors" in body) {
        return apiError(422, "Policy validation failed.", "VALIDATION_ERROR", { fieldErrors: body.fieldErrors });
      }

      if (body.status === "active") {
        const conflicting = await findConflictingActivePolicy(
          existingPolicy.organizationId,
          body.expenseType,
          existingPolicy.id,
        );
        if (conflicting) return policyConflict(conflicting);
      }

      const updatedPolicy: MockPolicy = {
        ...existingPolicy,
        name: body.name,
        description: body.description,
        expenseType: body.expenseType,
        approvalLimit: body.approvalLimit,
        rule: body.rule,
        status: body.status,
        updatedAt: new Date().toISOString(),
      };

      const action =
        existingPolicy.status !== updatedPolicy.status
          ? updatedPolicy.status === "active"
            ? "POLICY_ACTIVATED"
            : updatedPolicy.status === "inactive"
              ? "POLICY_DEACTIVATED"
              : "POLICY_UPDATED"
          : "POLICY_UPDATED";

      await runAuditedTransaction(
        ["policies"],
        {
          organizationId: updatedPolicy.organizationId,
          actorId: authorization.principal.userId,
          action,
          entityType: "POLICY",
          entityId: updatedPolicy.id,
          previousState: existingPolicy.status,
          newState: updatedPolicy.status,
          metadata: {
            changes: (["name", "description", "expenseType", "approvalLimit", "rule", "status"] as const)
              .filter((field) => JSON.stringify(existingPolicy[field]) !== JSON.stringify(updatedPolicy[field]))
              .map((field) => ({
                field,
                previousValue: existingPolicy[field],
                newValue: updatedPolicy[field],
              })),
          },
          description: `Updated policy ${updatedPolicy.name}.`,
        },
        (transaction) => {
          transaction.objectStore("policies").put(updatedPolicy);
        },
      );

      return HttpResponse.json(updatedPolicy);
    },
  ),
];
