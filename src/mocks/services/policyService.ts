import type {
  ExpensePolicy,
  PolicyEvaluation,
  PolicyEvaluationResult,
  PolicyEvaluationSnapshot,
} from "../../features/policies/types/policy";
import type { ExpenseType } from "../../features/expenses/types/expense";
import { indexedDbRepository } from "../repositories/indexedDbRepository";
import { listRecords } from "./mockDataService";
import { appendAuditEvent, type AuditEventInput } from "./auditService";

interface PolicyExpense {
  id: string;
  organizationId: string;
  departmentId?: string;
  type?: ExpenseType;
  amount: number;
  documentIds?: string[];
  projectId?: string;
  costCenterId?: string;
  policyEvaluation?: PolicyEvaluation;
  [key: string]: unknown;
}


function resolveExpenseType(expense: PolicyExpense): ExpenseType {
  // Expense type is the sole policy-selection input (§21.2).
  return expense.type ?? "OTHER";
}

export async function selectApplicablePolicy(
  organizationId: string,
  expenseType: ExpenseType,
): Promise<ExpensePolicy | undefined> {
  const policies = await listRecords<ExpensePolicy>("policies");

  return policies
    .filter(
      (policy) =>
        policy.organizationId === organizationId &&
        policy.status === "active" &&
        (!policy.expenseType || policy.expenseType === expenseType),
    )
    .sort((left, right) => {
      const specificity =
        Number(Boolean(right.expenseType)) -
        Number(Boolean(left.expenseType));

      if (specificity !== 0) {
        return specificity;
      }

      const updatedAt =
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime();

      if (updatedAt !== 0) {
        return updatedAt;
      }

      return String(left.id).localeCompare(String(right.id));
    })[0];
}

export async function evaluateExpensePolicy(
  expense: PolicyExpense,
): Promise<PolicyEvaluation> {
  const expenseType = resolveExpenseType(expense);
  const policy = await selectApplicablePolicy(
    expense.organizationId,
    expenseType,
  );
  const evaluatedAt = new Date().toISOString();

  if (!policy) {
    return {
      result: "NO_APPLICABLE_POLICY",
      evaluatedAt,
      details: {},
    };
  }

  const rule = policy.rule ?? {
    approvalThreshold: policy.approvalLimit,
  };

  const violatedRules: string[] = [];
  const missingInformation: string[] = [];

  if (
    typeof rule.maximumAmount === "number" &&
    expense.amount > rule.maximumAmount
  ) {
    violatedRules.push(
      `Amount exceeds the maximum allowed amount of ₹${rule.maximumAmount.toLocaleString(
        "en-IN",
      )}.`,
    );
  }

  if (
    rule.allowedDepartments?.length &&
    (!expense.departmentId ||
      !rule.allowedDepartments.includes(expense.departmentId))
  ) {
    violatedRules.push("Expense department is not allowed by this policy.");
  }

  if (
    rule.allowedProjects?.length &&
    (!expense.projectId ||
      !rule.allowedProjects.includes(expense.projectId))
  ) {
    violatedRules.push("Expense project is not allowed by this policy.");
  }

  if (
    rule.allowedCostCenters?.length &&
    (!expense.costCenterId ||
      !rule.allowedCostCenters.includes(expense.costCenterId))
  ) {
    violatedRules.push("Expense cost center is not allowed by this policy.");
  }

  if (rule.requiresReceipt && !(expense.documentIds?.length ?? 0)) {
    missingInformation.push("A receipt is required by this policy.");
  }

  let result: PolicyEvaluationResult = "COMPLIANT";

  if (missingInformation.length) {
    result = "MISSING_INFORMATION";
  } else if (violatedRules.length) {
    result = "VIOLATES_POLICY";
  } else if (
    typeof rule.approvalThreshold === "number" &&
    expense.amount > rule.approvalThreshold
  ) {
    result = "REQUIRES_APPROVAL";
  }

  return {
    policyId: policy.id,
    result,
    evaluatedAt,
    details: {
      violatedRules: violatedRules.length ? violatedRules : undefined,
      missingInformation: missingInformation.length
        ? missingInformation
        : undefined,
      requestedAmount: expense.amount,
      applicableLimit: rule.maximumAmount,
      approvalThreshold: rule.approvalThreshold,
    },
  };
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

