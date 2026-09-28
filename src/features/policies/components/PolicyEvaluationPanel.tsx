import { Alert, AlertTitle, Stack, Typography } from "@mui/material";
import type { PolicyEvaluation } from "../types/policy";
import { formatCurrency } from "../../../utils/currency";

interface PolicyEvaluationPanelProps {
  evaluation: PolicyEvaluation;
  title?: string;
  /** Shown under the title, e.g. that a draft is rechecked on submission. */
  note?: string;
}

const RESULT_TEXT: Record<PolicyEvaluation["result"], { label: string; severity: "success" | "info" | "warning" | "error" }> = {
  COMPLIANT: { label: "Meets the policy", severity: "success" },
  REQUIRES_APPROVAL: { label: "Needs a more senior approver", severity: "info" },
  VIOLATES_POLICY: { label: "Blocked by policy", severity: "error" },
  MISSING_INFORMATION: { label: "Missing information", severity: "error" },
  NO_APPLICABLE_POLICY: { label: "No policy applies", severity: "success" },
};

/** Policy check result: outcome, routing, blocking reasons and warnings. */
export function PolicyEvaluationPanel({ evaluation, title, note }: PolicyEvaluationPanelProps) {
  const { details } = evaluation;
  const warnings = details.warnings ?? [];
  const blocking = [...(details.missingInformation ?? []), ...(details.violatedRules ?? [])];
  const outcome = RESULT_TEXT[evaluation.result];
  const severity = outcome.severity === "success" && warnings.length ? "warning" : outcome.severity;

  return (
    <Alert severity={severity} variant="outlined">
      <AlertTitle>{title ?? "Policy check"}: {outcome.label}</AlertTitle>
      <Stack spacing={0.75}>
        {note && <Typography variant="body2" color="text.secondary">{note}</Typography>}
        {evaluation.policyName && (
          <Typography variant="body2">Policy: {evaluation.policyName}</Typography>
        )}
        {details.escalated && (
          <Typography variant="body2">
            Above the {details.approvalThreshold !== undefined ? `${formatCurrency(details.approvalThreshold)} ` : ""}approval threshold,
            so it goes to Finance (or an administrator, for managers&apos; expenses) instead of the team manager.
          </Typography>
        )}
        {blocking.map((message) => (
          <Typography key={message} variant="body2">• {message}</Typography>
        ))}
        {warnings.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ pt: 0.5 }}>Warnings for reviewers</Typography>
            {warnings.map((message) => (
              <Typography key={message} variant="body2">• {message}</Typography>
            ))}
          </>
        )}
        {!blocking.length && !warnings.length && !details.escalated && evaluation.result !== "NO_APPLICABLE_POLICY" && (
          <Typography variant="body2">All rules passed.</Typography>
        )}
      </Stack>
    </Alert>
  );
}
