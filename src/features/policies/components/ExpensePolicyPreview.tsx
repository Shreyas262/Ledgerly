import { Alert, AlertTitle, LinearProgress, Stack, Typography } from "@mui/material";
import { useGetApplicablePolicyQuery } from "../api/policiesApi";
import type { ExpenseType } from "../../expenses/types/expense";
import type { PolicyRules, RuleEnforcement } from "../types/policy";
import { formatCurrency } from "../../../utils/currency";
import { DETAILED_DESCRIPTION_MIN } from "../utils/policyConstants";
import { PolicyRuleList } from "./PolicyRuleList";

interface ExpensePolicyPreviewProps {
  type: ExpenseType;
  amount: string;
  expenseDate: string;
  description: string;
  /** When editing, the expense itself is excluded from the monthly total. */
  expenseId?: string;
}

const pad = (value: number) => String(value).padStart(2, "0");
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);

/** What the policy would say about the form's current values. Duplicates are checked on submission only. */
function liveFindings(rules: PolicyRules, amount: number, expenseDate: string, description: string, monthlyUsage: number) {
  const findings: Array<{ enforcement: RuleEnforcement | "ROUTE"; message: string }> = [];
  const today = localToday();
  if (amount > 0) {
    if (rules.maximumAmount && amount > rules.maximumAmount.amount) {
      findings.push({ enforcement: rules.maximumAmount.enforcement, message: `Above the ${formatCurrency(rules.maximumAmount.amount)} maximum per expense.` });
    }
    if (rules.monthlyLimit && monthlyUsage + amount > rules.monthlyLimit.amount) {
      findings.push({ enforcement: rules.monthlyLimit.enforcement, message: `Takes your monthly total to ${formatCurrency(monthlyUsage + amount)}, above the ${formatCurrency(rules.monthlyLimit.amount)} limit.` });
    }
    if (rules.descriptionRequiredAbove && amount > rules.descriptionRequiredAbove.amount && description.trim().length < DETAILED_DESCRIPTION_MIN) {
      findings.push({ enforcement: rules.descriptionRequiredAbove.enforcement, message: `Above ${formatCurrency(rules.descriptionRequiredAbove.amount)}, the description needs at least ${DETAILED_DESCRIPTION_MIN} characters.` });
    }
    if (rules.approvalThreshold !== undefined && amount > rules.approvalThreshold) {
      findings.push({ enforcement: "ROUTE", message: `Above the ${formatCurrency(rules.approvalThreshold)} approval threshold: it will be reviewed by Finance (or an administrator for managers).` });
    }
  }
  if (expenseDate) {
    if (rules.noFutureDates && expenseDate > today) {
      findings.push({ enforcement: rules.noFutureDates.enforcement, message: "The expense date is in the future." });
    }
    if (rules.submissionDeadline && daysBetween(expenseDate, today) > rules.submissionDeadline.days) {
      findings.push({ enforcement: rules.submissionDeadline.enforcement, message: `Expenses must be submitted within ${rules.submissionDeadline.days} days of the expense date.` });
    }
  }
  return findings;
}

/** Shows the applicable policy and live warnings while an expense is filled in (§21.12). */
export function ExpensePolicyPreview({ type, amount, expenseDate, description, expenseId }: ExpensePolicyPreviewProps) {
  const { data } = useGetApplicablePolicyQuery(
    { type, ...(expenseDate ? { date: expenseDate } : {}), ...(expenseId ? { excludeExpenseId: expenseId } : {}) },
    { refetchOnMountOrArgChange: true },
  );
  if (!data) return null;
  if (!data.policy) {
    return (
      <Alert severity="info" variant="outlined">
        No spending policy applies to this expense type. A receipt is still required before you submit.
      </Alert>
    );
  }

  const { rules } = data.policy;
  const numericAmount = Number(amount) || 0;
  const findings = liveFindings(rules, numericAmount, expenseDate, description, data.monthlyUsage);
  const blocking = findings.filter((finding) => finding.enforcement === "BLOCK");
  const severity = blocking.length ? "error" : findings.some((finding) => finding.enforcement === "WARN") ? "warning" : "info";
  const monthlyLimit = rules.monthlyLimit?.amount;

  return (
    <Alert severity={severity} variant="outlined">
      <AlertTitle>Policy: {data.policy.name}</AlertTitle>
      <Stack spacing={1.5}>
        <PolicyRuleList rules={rules} dense />
        {monthlyLimit !== undefined && (
          <Stack spacing={0.5}>
            <Typography variant="body2">
              Used this month: {formatCurrency(data.monthlyUsage)} of {formatCurrency(monthlyLimit)}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, ((data.monthlyUsage + numericAmount) / monthlyLimit) * 100)}
              color={data.monthlyUsage + numericAmount > monthlyLimit ? "error" : "primary"}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Stack>
        )}
        {findings.length > 0 && (
          <Stack spacing={0.5}>
            {findings.map((finding) => (
              <Typography key={finding.message} variant="body2">
                <strong>{finding.enforcement === "BLOCK" ? "Blocks submission" : finding.enforcement === "WARN" ? "Warning" : "Routing"}:</strong> {finding.message}
              </Typography>
            ))}
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary">
          Rules are checked again when you submit, including the duplicate check. A receipt is always required.
        </Typography>
      </Stack>
    </Alert>
  );
}
