import { Chip, Stack, Typography } from "@mui/material";
import type { PolicyRules } from "../types/policy";
import { describeRules, ENFORCEMENT_LABELS } from "../utils/policyText";

interface PolicyRuleListProps {
  rules: PolicyRules;
  dense?: boolean;
}

/** The policy's rules in plain language, each tagged Blocks, Warns or Routes up. */
export function PolicyRuleList({ rules, dense }: PolicyRuleListProps) {
  const summary = describeRules(rules);
  if (!summary.length) {
    return <Typography variant="body2" color="text.secondary">No rules configured.</Typography>;
  }
  return (
    <Stack spacing={dense ? 0.75 : 1.25}>
      {summary.map((rule) => (
        <Stack key={rule.key} direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Chip
            size="small"
            label={rule.enforcement ? ENFORCEMENT_LABELS[rule.enforcement] : "Routes up"}
            color={rule.enforcement === "BLOCK" ? "error" : rule.enforcement === "WARN" ? "warning" : "info"}
            variant="outlined"
            sx={{ minWidth: 84 }}
          />
          <Typography variant="body2">{rule.text}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}
