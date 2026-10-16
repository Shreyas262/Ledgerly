import { describe, expect, it } from "vitest";

import type { Expense } from "../../features/expenses/types/expense";
import type { ExpensePolicy, PolicyEvaluationResult, PolicyRules } from "../../features/policies/types/policy";
import { givenExpense, givenPolicy, withFixedToday } from "../../test/fixtures";
import {
  evaluateExpensePolicy,
  evaluatePolicyRules,
  isSubmissionAllowed,
  selectApplicablePolicy,
  type PolicyRuleContext,
  type PolicyRuleInput,
} from "./policyService";

const TODAY = "2026-10-16";
const RECEIPT_REQUIRED = "A receipt or supporting document is required before submission.";

function policyWith(rules: PolicyRules): ExpensePolicy {
  return {
    id: "policy-1",
    organizationId: "org-1",
    name: "Meals policy",
    rules,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const compliantInput: PolicyRuleInput = {
  amount: 1_500,
  expenseDate: "2026-10-10",
  description: "Dinner with the visiting client team",
  hasDocument: true,
};

const quietContext: PolicyRuleContext = { monthlySpent: 0, hasDuplicate: false, today: TODAY };

// Each rule with an input that breaks it (§21.4).
const BROKEN_RULES: Array<[keyof PolicyRules, (enforcement: "BLOCK" | "WARN") => PolicyRules, Partial<PolicyRuleInput>, Partial<PolicyRuleContext>]> = [
  ["maximumAmount", (enforcement) => ({ maximumAmount: { amount: 1_000, enforcement } }), {}, {}],
  ["monthlyLimit", (enforcement) => ({ monthlyLimit: { amount: 5_000, enforcement } }), {}, { monthlySpent: 4_000 }],
  ["submissionDeadline", (enforcement) => ({ submissionDeadline: { days: 30, enforcement } }), { expenseDate: "2026-08-01" }, {}],
  ["duplicateCheck", (enforcement) => ({ duplicateCheck: { enforcement } }), {}, { hasDuplicate: true }],
  ["descriptionRequiredAbove", (enforcement) => ({ descriptionRequiredAbove: { amount: 1_000, enforcement } }), { description: "Dinner" }, {}],
  ["noFutureDates", (enforcement) => ({ noFutureDates: { enforcement } }), { expenseDate: "2026-10-20" }, {}],
];

describe("evaluatePolicyRules", () => {
  it("requires a receipt even when no policy applies", () => {
    const evaluation = evaluatePolicyRules(undefined, { ...compliantInput, hasDocument: false }, quietContext);

    expect(evaluation.result).toBe("MISSING_INFORMATION");
    expect(evaluation.details.missingInformation).toEqual([RECEIPT_REQUIRED]);
    expect(isSubmissionAllowed(evaluation)).toBe(false);
  });

  it("reports that no policy applies when a receipt is attached", () => {
    const evaluation = evaluatePolicyRules(undefined, compliantInput, quietContext);

    expect(evaluation.result).toBe("NO_APPLICABLE_POLICY");
    expect(isSubmissionAllowed(evaluation)).toBe(true);
  });

  it.each(BROKEN_RULES)("blocks submission when %s is a Block rule", (rule, rules, input, context) => {
    const evaluation = evaluatePolicyRules(policyWith(rules("BLOCK")), { ...compliantInput, ...input }, { ...quietContext, ...context });

    expect(evaluation.result).toBe("VIOLATES_POLICY");
    expect(evaluation.details.findings).toEqual([expect.objectContaining({ rule, enforcement: "BLOCK" })]);
    expect(evaluation.details.violatedRules).toHaveLength(1);
    expect(isSubmissionAllowed(evaluation)).toBe(false);
  });

  it.each(BROKEN_RULES)("only warns when %s is a Warn rule", (rule, rules, input, context) => {
    const evaluation = evaluatePolicyRules(policyWith(rules("WARN")), { ...compliantInput, ...input }, { ...quietContext, ...context });

    expect(evaluation.result).toBe("COMPLIANT");
    expect(evaluation.details.findings).toEqual([expect.objectContaining({ rule, enforcement: "WARN" })]);
    expect(evaluation.details.warnings).toHaveLength(1);
    expect(isSubmissionAllowed(evaluation)).toBe(true);
  });

  it("is compliant exactly at each limit", () => {
    const policy = policyWith({
      maximumAmount: { amount: 1_500, enforcement: "BLOCK" },
      monthlyLimit: { amount: 5_000, enforcement: "BLOCK" },
      submissionDeadline: { days: 6, enforcement: "BLOCK" },
      approvalThreshold: 1_500,
    });

    const evaluation = evaluatePolicyRules(policy, compliantInput, { ...quietContext, monthlySpent: 3_500 });

    expect(evaluation.result).toBe("COMPLIANT");
    expect(evaluation.details.findings).toBeUndefined();
  });

  it("routes an expense above the approval threshold up without blocking it", () => {
    const evaluation = evaluatePolicyRules(policyWith({ approvalThreshold: 1_000 }), compliantInput, quietContext);

    expect(evaluation.result).toBe("REQUIRES_APPROVAL");
    expect(evaluation.details).toMatchObject({ escalated: true, approvalThreshold: 1_000 });
    expect(isSubmissionAllowed(evaluation)).toBe(true);
  });

  // §21.6: a missing receipt outranks rule violations, which outrank routing.
  it.each<[string, PolicyRules, Partial<PolicyRuleInput>, PolicyEvaluationResult]>([
    ["missing receipt and a Block rule", { maximumAmount: { amount: 1_000, enforcement: "BLOCK" } }, { hasDocument: false }, "MISSING_INFORMATION"],
    ["a Block rule above the threshold", { maximumAmount: { amount: 1_000, enforcement: "BLOCK" }, approvalThreshold: 500 }, {}, "VIOLATES_POLICY"],
    ["a Warn rule above the threshold", { maximumAmount: { amount: 1_000, enforcement: "WARN" }, approvalThreshold: 500 }, {}, "REQUIRES_APPROVAL"],
  ])("reports %s as %s", (_name, rules, input, result) => {
    expect(evaluatePolicyRules(policyWith(rules), { ...compliantInput, ...input }, quietContext).result).toBe(result);
  });
});

describe("selectApplicablePolicy", () => {
  it("picks the most specific active policy for the expense type and department", async () => {
    const organizationWide = await givenPolicy({ name: "All types" });
    const departmentWide = await givenPolicy({ name: "Engineering", departmentIds: ["dept-engineering"] });
    const typeWide = await givenPolicy({ name: "Meals", expenseType: "MEALS" });
    const departmentType = await givenPolicy({ name: "Engineering meals", expenseType: "MEALS", departmentIds: ["dept-engineering"] });

    expect((await selectApplicablePolicy("org-1", "MEALS", "dept-engineering"))?.id).toBe(departmentType.id);
    expect((await selectApplicablePolicy("org-1", "MEALS", "dept-operations"))?.id).toBe(typeWide.id);
    expect((await selectApplicablePolicy("org-1", "TRAVEL", "dept-engineering"))?.id).toBe(departmentWide.id);
    expect((await selectApplicablePolicy("org-1", "TRAVEL", "dept-operations"))?.id).toBe(organizationWide.id);
  });

  it("ignores draft and inactive policies and other organizations' policies", async () => {
    await givenPolicy({ expenseType: "MEALS", status: "draft" });
    await givenPolicy({ expenseType: "MEALS", status: "inactive" });
    await givenPolicy({ expenseType: "MEALS", organizationId: "org-2" });

    expect(await selectApplicablePolicy("org-1", "MEALS", "dept-engineering")).toBeUndefined();
  });

  it("prefers the most recently updated policy when specificity ties", async () => {
    await givenPolicy({ expenseType: "MEALS", updatedAt: "2026-01-01T00:00:00.000Z" });
    const newer = await givenPolicy({ expenseType: "MEALS", updatedAt: "2026-06-01T00:00:00.000Z" });

    expect((await selectApplicablePolicy("org-1", "MEALS", "dept-engineering"))?.id).toBe(newer.id);
  });
});

describe("evaluateExpensePolicy", () => {
  withFixedToday(TODAY);

  const evaluate = (expense: Expense) => evaluateExpensePolicy({ ...expense });

  it("flags a duplicate with the same type, amount and date, ignoring rejected and cancelled ones", async () => {
    await givenPolicy({ rules: { duplicateCheck: { enforcement: "BLOCK" } } });
    const draft = await givenExpense({ status: "draft", documentIds: ["document-1"] });
    await givenExpense({ status: "rejected" });
    await givenExpense({ status: "cancelled" });
    await givenExpense({ status: "submitted", type: "TRAVEL" });
    await givenExpense({ status: "submitted", amount: 999 });

    expect((await evaluate(draft)).result).toBe("COMPLIANT");

    await givenExpense({ status: "approved" });
    expect((await evaluate(draft)).result).toBe("VIOLATES_POLICY");
  });

  it("counts submitted spend of the same type in the same month towards the monthly limit", async () => {
    await givenPolicy({ expenseType: "MEALS", rules: { monthlyLimit: { amount: 3_000, enforcement: "BLOCK" } } });
    const draft = await givenExpense({ status: "draft", amount: 1_000, documentIds: ["document-1"] });
    await givenExpense({ status: "reimbursed", amount: 1_500, expenseDate: "2026-10-03" });
    await givenExpense({ status: "draft", amount: 5_000, expenseDate: "2026-10-04" });
    await givenExpense({ status: "rejected", amount: 5_000, expenseDate: "2026-10-04" });
    await givenExpense({ status: "approved", amount: 5_000, expenseDate: "2026-09-30" });
    await givenExpense({ status: "approved", amount: 5_000, expenseDate: "2026-10-04", type: "TRAVEL" });

    expect((await evaluate(draft)).result).toBe("COMPLIANT");

    await givenExpense({ status: "under_review", amount: 600, expenseDate: "2026-10-05" });
    expect((await evaluate(draft)).result).toBe("VIOLATES_POLICY");
  });
});
