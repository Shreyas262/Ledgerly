import type {
  ExpensePolicy,
  PolicyEvaluation,
  PolicyEvaluationResult,
  PolicyEvaluationSnapshot,
  PolicyFinding,
  PolicyFindingRule,
  RuleEnforcement,
} from "../../features/policies/types/policy";
import type { ExpenseType } from "../../features/expenses/types/expense";
import { indexedDbRepository } from "../repositories/indexedDbRepository";
import { listRecords, listRecordsByIndex } from "./mockDataService";
import { appendAuditEvent, type AuditEventInput } from "./auditService";
import { todayDate } from "./budgetService";
import { DETAILED_DESCRIPTION_MIN as DETAILED_DESCRIPTION_LENGTH } from "../../features/policies/utils/policyConstants";

interface PolicyExpense {
  id: string;
  organizationId: string;
  employeeId?: string;
  departmentId?: string;
  type?: ExpenseType;
  amount: number;
  expenseDate?: string;
  description?: string;
  documentIds?: string[];
  policyEvaluation?: PolicyEvaluation;
  [key: string]: unknown;
}

/** Statuses counted towards the monthly limit: submitted and not rejected or cancelled. */
export const MONTHLY_LIMIT_STATUSES = new Set([
  "submitted", "under_review", "approved", "reimbursement_pending", "reimbursed",
]);


const RECEIPT_REQUIRED = "A receipt or supporting document is required before submission.";

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime()) / DAY_MS);

function resolveExpenseType(expense: PolicyExpense): ExpenseType {
  // Expense type is the primary policy-selection input (§21.2).
  return expense.type ?? "OTHER";
}

const appliesToDepartment = (policy: ExpensePolicy, departmentId: string | undefined) =>
  !policy.departmentIds?.length || (departmentId !== undefined && policy.departmentIds.includes(departmentId));

/**
 * §21.3: the most specific active policy wins — a type-specific policy over
 * an all-types one, then a department-specific policy over an
 * organization-wide one; the most recently updated breaks ties.
 */
export async function selectApplicablePolicy(
  organizationId: string,
  expenseType: ExpenseType,
  departmentId?: string,
): Promise<ExpensePolicy | undefined> {
  const policies = await listRecords<ExpensePolicy>("policies");
  const specificity = (policy: ExpensePolicy) =>
    (policy.expenseType ? 2 : 0) + (policy.departmentIds?.length ? 1 : 0);

  return policies
    .filter(
      (policy) =>
        policy.organizationId === organizationId &&
        policy.status === "active" &&
        (!policy.expenseType || policy.expenseType === expenseType) &&
        appliesToDepartment(policy, departmentId),
    )
    .sort((left, right) =>
      specificity(right) - specificity(left) ||
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
      String(left.id).localeCompare(String(right.id)),
    )[0];
}

/** An employee's counted spend in a calendar month (YYYY-MM), optionally for one expense type. */
export async function getMonthlySpend(
  employeeId: string,
  month: string,
  expenseType: ExpenseType | undefined,
  excludeExpenseId?: string,
): Promise<number> {
  const expenses = await listRecordsByIndex<PolicyExpense & { status: string }>("expenses", "employeeId", employeeId);
  return expenses
    .filter((expense) =>
      expense.id !== excludeExpenseId &&
      MONTHLY_LIMIT_STATUSES.has(expense.status) &&
      String(expense.expenseDate ?? "").slice(0, 7) === month &&
      (!expenseType || resolveExpenseType(expense) === expenseType))
    .reduce((total, expense) => total + expense.amount, 0);
}

async function hasDuplicate(expense: PolicyExpense): Promise<boolean> {
  if (!expense.employeeId) return false;
  const expenses = await listRecordsByIndex<PolicyExpense & { status: string }>("expenses", "employeeId", expense.employeeId);
  return expenses.some((other) =>
    other.id !== expense.id &&
    other.status !== "cancelled" &&
    other.status !== "rejected" &&
    resolveExpenseType(other) === resolveExpenseType(expense) &&
    other.amount === expense.amount &&
    String(other.expenseDate ?? "").slice(0, 10) === String(expense.expenseDate ?? "").slice(0, 10));
}

export interface PolicyRuleInput {
  amount: number;
  expenseDate: string;
  description?: string;
  hasDocument: boolean;
}

export interface PolicyRuleContext {
  /** Counted spend this month, excluding this expense. */
  monthlySpent: number;
  hasDuplicate: boolean;
  /** The date the expense is (or would be) submitted. */
  today: string;
}

/** Evaluates a policy's rules against an expense. Pure: no persistence. */
export function evaluatePolicyRules(
  policy: ExpensePolicy | undefined,
  input: PolicyRuleInput,
  context: PolicyRuleContext,
): PolicyEvaluation {
  const evaluatedAt = new Date().toISOString();
  const findings: PolicyFinding[] = [];
  const add = (rule: PolicyFindingRule, enforcement: RuleEnforcement, message: string) =>
    findings.push({ rule, enforcement, message });

  // Baseline documentation rule applies with or without a policy (§21.14).
  if (!input.hasDocument) add("receipt", "BLOCK", RECEIPT_REQUIRED);

  const rules = policy?.rules ?? {};
  if (rules.maximumAmount && input.amount > rules.maximumAmount.amount) {
    add("maximumAmount", rules.maximumAmount.enforcement, `Amount exceeds the maximum of ${money(rules.maximumAmount.amount)} per expense.`);
  }
  if (rules.monthlyLimit && context.monthlySpent + input.amount > rules.monthlyLimit.amount) {
    add(
      "monthlyLimit",
      rules.monthlyLimit.enforcement,
      `This takes your monthly total to ${money(context.monthlySpent + input.amount)}, above the ${money(rules.monthlyLimit.amount)} monthly limit.`,
    );
  }
  if (rules.submissionDeadline && daysBetween(input.expenseDate, context.today) > rules.submissionDeadline.days) {
    add(
      "submissionDeadline",
      rules.submissionDeadline.enforcement,
      `Expenses must be submitted within ${rules.submissionDeadline.days} days of the expense date.`,
    );
  }
  if (rules.duplicateCheck && context.hasDuplicate) {
    add("duplicateCheck", rules.duplicateCheck.enforcement, "You have another expense with the same type, amount and date.");
  }
  if (
    rules.descriptionRequiredAbove &&
    input.amount > rules.descriptionRequiredAbove.amount &&
    (input.description ?? "").trim().length < DETAILED_DESCRIPTION_LENGTH
  ) {
    add(
      "descriptionRequiredAbove",
      rules.descriptionRequiredAbove.enforcement,
      `Expenses above ${money(rules.descriptionRequiredAbove.amount)} need a detailed description (at least ${DETAILED_DESCRIPTION_LENGTH} characters).`,
    );
  }
  if (rules.noFutureDates && input.expenseDate.slice(0, 10) > context.today) {
    add("noFutureDates", rules.noFutureDates.enforcement, "The expense date cannot be in the future.");
  }

  const escalated = typeof rules.approvalThreshold === "number" && input.amount > rules.approvalThreshold;
  const blocking = findings.filter((finding) => finding.enforcement === "BLOCK");
  const missingInformation = blocking.filter((finding) => finding.rule === "receipt").map((finding) => finding.message);
  const violatedRules = blocking.filter((finding) => finding.rule !== "receipt").map((finding) => finding.message);
  const warnings = findings.filter((finding) => finding.enforcement === "WARN").map((finding) => finding.message);

  let result: PolicyEvaluationResult;
  if (missingInformation.length) result = "MISSING_INFORMATION";
  else if (violatedRules.length) result = "VIOLATES_POLICY";
  else if (!policy) result = "NO_APPLICABLE_POLICY";
  else if (escalated) result = "REQUIRES_APPROVAL";
  else result = "COMPLIANT";

  return {
    policyId: policy?.id,
    policyName: policy?.name,
    result,
    evaluatedAt,
    details: {
      violatedRules: violatedRules.length ? violatedRules : undefined,
      missingInformation: missingInformation.length ? missingInformation : undefined,
      warnings: warnings.length ? warnings : undefined,
      findings: findings.length ? findings : undefined,
      requestedAmount: input.amount,
      applicableLimit: rules.maximumAmount?.amount,
      approvalThreshold: rules.approvalThreshold,
      escalated: escalated || undefined,
    },
  };
}

export async function evaluateExpensePolicy(
  expense: PolicyExpense,
): Promise<PolicyEvaluation> {
  const expenseType = resolveExpenseType(expense);
  const policy = await selectApplicablePolicy(expense.organizationId, expenseType, expense.departmentId);
  const expenseDate = String(expense.expenseDate ?? todayDate()).slice(0, 10);
  const rules = policy?.rules ?? {};

  return evaluatePolicyRules(
    policy,
    {
      amount: expense.amount,
      expenseDate,
      description: expense.description,
      hasDocument: (expense.documentIds?.length ?? 0) > 0,
    },
    {
      monthlySpent: rules.monthlyLimit && expense.employeeId
        ? await getMonthlySpend(expense.employeeId, expenseDate.slice(0, 7), policy?.expenseType, expense.id)
        : 0,
      hasDuplicate: rules.duplicateCheck ? await hasDuplicate(expense) : false,
      today: todayDate(),
    },
  );
}

/** Whether the expense was above its policy's approval threshold when submitted (§22.3). */
export function requiresEscalation(expense: { policyEvaluation?: PolicyEvaluation }): boolean {
  return expense.policyEvaluation?.details.escalated === true;
}

export async function persistExpenseSubmissionEvaluation(
  expense: PolicyExpense,
  evaluation: PolicyEvaluation,
  submit = true,
  audit?: AuditEventInput,
): Promise<PolicyEvaluationSnapshot> {
  const snapshot: PolicyEvaluationSnapshot = {
    id: crypto.randomUUID(),
    expenseId: expense.id,
    organizationId: expense.organizationId,
    policyId: evaluation.policyId,
    policyName: evaluation.policyName,
    result: evaluation.result,
    evaluatedAt: evaluation.evaluatedAt,
    details: evaluation.details,
  };

  await indexedDbRepository.transaction(
    ["expenses", "policyEvaluations", "auditEvents"],
    (transaction) => {
      const expenseStore = transaction.objectStore("expenses");
      const evaluationStore = transaction.objectStore("policyEvaluations");

      const updatedExpense = {
        ...expense,
        status: submit ? "submitted" : expense.status,
        policyId: evaluation.policyId,
        policyEvaluation: evaluation,
        ...(submit ? { submittedAt: evaluation.evaluatedAt } : {}),
        updatedAt: evaluation.evaluatedAt,
      };

      expenseStore.put(updatedExpense);
      evaluationStore.put(snapshot);

      if (audit) {
        appendAuditEvent(transaction, audit);
      }
    },
  );

  return snapshot;
}

export function isSubmissionAllowed(
  evaluation: PolicyEvaluation,
): boolean {
  return (
    evaluation.result !== "VIOLATES_POLICY" &&
    evaluation.result !== "MISSING_INFORMATION"
  );
}
