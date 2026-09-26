import { applyCollectionQuery, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";
import { apiError } from "../services/apiError";

import {
  authorizeCollection,
  authorizeRequest,
  resolveAuthenticatedPrincipal,
} from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { runAuditedTransaction } from "../services/auditService";
import {
  evaluatePolicyRules,
  getMonthlySpend,
  selectApplicablePolicy,
} from "../services/policyService";
import { todayDate } from "../services/budgetService";
import type { ExpenseType } from "../../features/expenses/types/expense";
import type {
  ExpensePolicy,
  PolicyRules,
  RuleEnforcement,
} from "../../features/policies/types/policy";

import {
  getRecord,
  listRecords,
} from "../services/mockDataService";

type MockPolicy = ExpensePolicy & { [key: string]: unknown };

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
const ENFORCEMENTS = new Set(["BLOCK", "WARN"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface PolicyInput {
  name: string;
  description?: string;
  expenseType?: ExpenseType;
  departmentIds: string[];
  rules: PolicyRules;
  status: ExpensePolicy["status"];
}

function isPositiveAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Validates and normalizes the rules object; unknown keys are dropped. */
function validateRules(raw: unknown, fieldErrors: Record<string, string>): PolicyRules {
  const value = raw && typeof raw === "object" ? (raw as Record<string, Record<string, unknown> | number | undefined>) : {};
  const rules: PolicyRules = {};
  const enforcementOf = (key: string, rule: Record<string, unknown>): RuleEnforcement | null => {
    if (typeof rule.enforcement === "string" && ENFORCEMENTS.has(rule.enforcement)) return rule.enforcement as RuleEnforcement;
    fieldErrors[key] = "Choose whether this rule blocks or warns.";
    return null;
  };
  const amountRule = (key: "maximumAmount" | "monthlyLimit" | "descriptionRequiredAbove", label: string) => {
    const rule = value[key];
    if (rule === undefined || rule === null) return;
    if (typeof rule !== "object" || !isPositiveAmount(rule.amount)) {
      fieldErrors[key] = `${label} must be greater than 0.`;
      return;
    }
    const enforcement = enforcementOf(key, rule);
    if (enforcement) rules[key] = { amount: rule.amount, enforcement };
  };
  const toggleRule = (key: "duplicateCheck" | "noFutureDates") => {
    const rule = value[key];
    if (rule === undefined || rule === null) return;
    if (typeof rule !== "object") {
      fieldErrors[key] = "Invalid rule.";
      return;
    }
    const enforcement = enforcementOf(key, rule);
    if (enforcement) rules[key] = { enforcement };
  };

  amountRule("maximumAmount", "Maximum amount");
  amountRule("monthlyLimit", "Monthly limit");
  amountRule("descriptionRequiredAbove", "Description amount");
  toggleRule("duplicateCheck");
  toggleRule("noFutureDates");

  if (value.approvalThreshold !== undefined && value.approvalThreshold !== null) {
    if (isPositiveAmount(value.approvalThreshold)) rules.approvalThreshold = value.approvalThreshold;
    else fieldErrors.approvalThreshold = "Approval threshold must be greater than 0.";
  }

  const deadline = value.submissionDeadline;
  if (deadline !== undefined && deadline !== null) {
    if (typeof deadline !== "object" || !Number.isInteger(deadline.days) || (deadline.days as number) < 1 || (deadline.days as number) > 365) {
      fieldErrors.submissionDeadline = "Submission deadline must be between 1 and 365 days.";
    } else {
      const enforcement = enforcementOf("submissionDeadline", deadline);
      if (enforcement) rules.submissionDeadline = { days: deadline.days as number, enforcement };
    }
  }

  if (rules.maximumAmount && rules.approvalThreshold !== undefined && rules.maximumAmount.enforcement === "BLOCK" && rules.approvalThreshold >= rules.maximumAmount.amount) {
    fieldErrors.approvalThreshold = "The approval threshold must be below the blocking maximum amount.";
  }
  if (!Object.keys(rules).length && !Object.keys(fieldErrors).length) {
    fieldErrors.rules = "Add at least one rule.";
  }
  return rules;
}

async function validatePolicyBody(body: unknown, organizationId: string): Promise<PolicyInput | { fieldErrors: Record<string, string> }> {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const fieldErrors: Record<string, string> = {};
  const name = typeof value.name === "string" ? value.name.trim() : "";

  if (!name) fieldErrors.name = "Policy name is required.";
  if (value.expenseType !== undefined && value.expenseType !== null && (typeof value.expenseType !== "string" || !EXPENSE_TYPES.has(value.expenseType))) {
    fieldErrors.expenseType = "A valid expense type is required.";
  }
  if (typeof value.status !== "string" || !POLICY_STATUSES.has(value.status)) fieldErrors.status = "A valid policy status is required.";

  let departmentIds: string[] = [];
  if (value.departmentIds !== undefined && value.departmentIds !== null) {
    if (!Array.isArray(value.departmentIds) || value.departmentIds.some((id) => typeof id !== "string")) {
      fieldErrors.departmentIds = "Departments must be a list.";
    } else {
      departmentIds = Array.from(new Set(value.departmentIds as string[]));
      const departments = await listRecords<{ id: string; organizationId: string }>("departments");
      if (departmentIds.some((id) => !departments.some((department) => department.id === id && department.organizationId === organizationId))) {
        fieldErrors.departmentIds = "Choose departments from your organization.";
      }
    }
  }

  const rules = validateRules(value.rules, fieldErrors);
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  return {
    name,
    description: typeof value.description === "string" && value.description.trim() ? value.description.trim() : undefined,
    expenseType: (value.expenseType ?? undefined) as ExpenseType | undefined,
    departmentIds,
    rules,
    status: value.status as ExpensePolicy["status"],
  };
}

/**
 * §21.8: at most one active policy per expense type and department. An
 * organization-wide policy (no departments) conflicts only with another
 * organization-wide policy for the same type; department policies conflict
 * when their departments overlap.
 */
async function findConflictingActivePolicy(
  organizationId: string,
  expenseType: string | undefined,
  departmentIds: string[],
  excludePolicyId?: string,
): Promise<MockPolicy | undefined> {
  const policies = await listRecords<MockPolicy>("policies");
  return policies.find((policy) => {
    if (
      policy.id === excludePolicyId ||
      policy.organizationId !== organizationId ||
      policy.status !== "active" ||
      (policy.expenseType ?? null) !== (expenseType ?? null)
    ) return false;
    const other = policy.departmentIds ?? [];
    if (!other.length || !departmentIds.length) return !other.length && !departmentIds.length;
    return other.some((id) => departmentIds.includes(id));
  });
}

function policyConflict(conflicting: MockPolicy) {
  return apiError(
    409,
    `An active policy ("${conflicting.name}") already applies to this expense type and scope. Deactivate it first.`,
    "POLICY_CONFLICT",
    { conflictingResource: { id: conflicting.id, name: conflicting.name } },
  );
}

const validationFailed = (fieldErrors: Record<string, string>) =>
  apiError(422, Object.values(fieldErrors)[0] ?? "Policy validation failed.", "VALIDATION_ERROR", { fieldErrors });

export const policiesHandlers = [
  // §21.12: any signed-in user may read the summary of the policy that applies
  // to them for an expense type, plus their counted spend this month.
  http.get("/api/policies/applicable", async ({ request }) => {
    const principal = await resolveAuthenticatedPrincipal(request);
    if (!principal) return apiError(401, "Authentication required.");
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "";
    if (!EXPENSE_TYPES.has(type)) return apiError(400, "A valid expense type is required.", "INVALID_FILTER");
    const date = url.searchParams.get("date");
    const month = (date && DATE_PATTERN.test(date) ? date : todayDate()).slice(0, 7);
    const excludeExpenseId = url.searchParams.get("excludeExpenseId") ?? undefined;

    const policy = await selectApplicablePolicy(principal.organizationId, type as ExpenseType, principal.departmentId);
    return HttpResponse.json({
      policy: policy
        ? { id: policy.id, name: policy.name, description: policy.description, expenseType: policy.expenseType, departmentIds: policy.departmentIds, rules: policy.rules }
        : null,
      monthlyUsage: policy?.rules.monthlyLimit
        ? await getMonthlySpend(principal.userId, month, policy.expenseType, excludeExpenseId)
        : 0,
      month,
    });
  }),

  // §21.13: simulate the applicable policy for a hypothetical expense.
  http.post("/api/policies/preview", async ({ request }) => {
    const authorization = await authorizeRequest(request, { permission: "policies.read", scope: "ORGANIZATION" });
    if (!authorization.allowed) return authorizationError(authorization);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const fieldErrors: Record<string, string> = {};
    if (typeof body.expenseType !== "string" || !EXPENSE_TYPES.has(body.expenseType)) fieldErrors.expenseType = "Choose an expense type.";
    if (!isPositiveAmount(body.amount)) fieldErrors.amount = "Enter an amount greater than 0.";
    if (typeof body.expenseDate !== "string" || !DATE_PATTERN.test(body.expenseDate)) fieldErrors.expenseDate = "Enter a valid date.";
    if (typeof body.departmentId !== "string" || !body.departmentId) fieldErrors.departmentId = "Choose a department.";
    if (body.monthlySpent !== undefined && (typeof body.monthlySpent !== "number" || body.monthlySpent < 0)) fieldErrors.monthlySpent = "Enter 0 or more.";
    if (body.submissionDate !== undefined && (typeof body.submissionDate !== "string" || !DATE_PATTERN.test(body.submissionDate))) fieldErrors.submissionDate = "Enter a valid date.";
    if (Object.keys(fieldErrors).length) return validationFailed(fieldErrors);

    const policy = await selectApplicablePolicy(
      authorization.principal.organizationId,
      body.expenseType as ExpenseType,
      body.departmentId as string,
    );
    const evaluation = evaluatePolicyRules(
      policy,
      {
        amount: body.amount as number,
        expenseDate: body.expenseDate as string,
        description: typeof body.description === "string" ? body.description : "",
        hasDocument: true,
      },
      {
        monthlySpent: (body.monthlySpent as number | undefined) ?? 0,
        hasDuplicate: false,
        today: (body.submissionDate as string | undefined) ?? todayDate(),
      },
    );
    return HttpResponse.json({ evaluation, policy: policy ?? null });
  }),

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
    const body = await validatePolicyBody(await request.json().catch(() => ({})), authorization.principal.organizationId);
    if ("fieldErrors" in body) return validationFailed(body.fieldErrors);

    if (body.status === "active") {
      const conflicting = await findConflictingActivePolicy(
        authorization.principal.organizationId,
        body.expenseType,
        body.departmentIds,
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
      departmentIds: body.departmentIds,
      rules: body.rules,
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

      const body = await validatePolicyBody(await request.json().catch(() => ({})), existingPolicy.organizationId);
      if ("fieldErrors" in body) return validationFailed(body.fieldErrors);

      if (body.status === "active") {
        const conflicting = await findConflictingActivePolicy(
          existingPolicy.organizationId,
          body.expenseType,
          body.departmentIds,
          existingPolicy.id,
        );
        if (conflicting) return policyConflict(conflicting);
      }

      const updatedPolicy: MockPolicy = {
        ...existingPolicy,
        name: body.name,
        description: body.description,
        expenseType: body.expenseType,
        departmentIds: body.departmentIds,
        rules: body.rules,
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
            changes: (["name", "description", "expenseType", "departmentIds", "rules", "status"] as const)
              .filter((field) => JSON.stringify(existingPolicy[field] ?? null) !== JSON.stringify(updatedPolicy[field] ?? null))
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
