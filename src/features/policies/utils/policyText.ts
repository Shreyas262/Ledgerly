import type { PolicyFindingRule, PolicyRules, RuleEnforcement } from "../types/policy";
import { formatCurrency } from "../../../utils/currency";

export const RULE_LABELS: Record<PolicyFindingRule | "approvalThreshold", string> = {
  receipt: "Receipt",
  maximumAmount: "Maximum amount",
  approvalThreshold: "Approval threshold",
  monthlyLimit: "Monthly limit",
  submissionDeadline: "Submission deadline",
  duplicateCheck: "Duplicate check",
  descriptionRequiredAbove: "Detailed description",
  noFutureDates: "No future dates",
};

export const ENFORCEMENT_LABELS: Record<RuleEnforcement, string> = {
  BLOCK: "Blocks",
  WARN: "Warns",
};

export interface RuleSummary {
  key: keyof PolicyRules;
  text: string;
  enforcement?: RuleEnforcement;
}

/** Each configured rule in plain language, in a stable order. */
export function describeRules(rules: PolicyRules): RuleSummary[] {
  const summary: RuleSummary[] = [];
  if (rules.maximumAmount) {
    summary.push({ key: "maximumAmount", enforcement: rules.maximumAmount.enforcement, text: `Above ${formatCurrency(rules.maximumAmount.amount)} per expense` });
  }
  if (rules.approvalThreshold !== undefined) {
    summary.push({ key: "approvalThreshold", text: `Above ${formatCurrency(rules.approvalThreshold)} needs a more senior approver` });
  }
  if (rules.monthlyLimit) {
    summary.push({ key: "monthlyLimit", enforcement: rules.monthlyLimit.enforcement, text: `Above ${formatCurrency(rules.monthlyLimit.amount)} per employee per month` });
  }
  if (rules.submissionDeadline) {
    summary.push({ key: "submissionDeadline", enforcement: rules.submissionDeadline.enforcement, text: `Submitted more than ${rules.submissionDeadline.days} days after the expense date` });
  }
  if (rules.descriptionRequiredAbove) {
    summary.push({ key: "descriptionRequiredAbove", enforcement: rules.descriptionRequiredAbove.enforcement, text: `No detailed description above ${formatCurrency(rules.descriptionRequiredAbove.amount)}` });
  }
  if (rules.duplicateCheck) {
    summary.push({ key: "duplicateCheck", enforcement: rules.duplicateCheck.enforcement, text: "Possible duplicate (same type, amount and date)" });
  }
  if (rules.noFutureDates) {
    summary.push({ key: "noFutureDates", enforcement: rules.noFutureDates.enforcement, text: "Expense dated in the future" });
  }
  return summary;
}

/** One short line per rule, e.g. "Blocks: above ₹5,000 per expense". */
export function ruleLine(rule: RuleSummary): string {
  return rule.enforcement ? `${ENFORCEMENT_LABELS[rule.enforcement]}: ${rule.text.charAt(0).toLowerCase()}${rule.text.slice(1)}` : rule.text;
}
