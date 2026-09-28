import {
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import type { ExpensePolicy } from "../types/policy";
import { EXPENSE_TYPE_LABELS } from "../../expenses/types/expense";
import { humanize } from "../../../utils/format";
import { PolicyRuleList } from "./PolicyRuleList";

interface PolicyCardProps {
  policy: ExpensePolicy;
  departmentName: (id: string) => string;
  onView: (policy: ExpensePolicy) => void;
}

const STATUS_COLOR = { active: "success", draft: "warning", inactive: "default" } as const;

export function PolicyCard({
  policy,
  departmentName,
  onView,
}: PolicyCardProps) {
  const scope = policy.departmentIds?.length
    ? policy.departmentIds.map(departmentName).join(", ")
    : "Whole organization";

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
        <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1">{policy.name}</Typography>
            {policy.description && (
              <Typography variant="body2" color="text.secondary">{policy.description}</Typography>
            )}
          </Stack>
          <Chip label={humanize(policy.status)} color={STATUS_COLOR[policy.status]} size="small" />
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Chip size="small" variant="outlined" label={policy.expenseType ? EXPENSE_TYPE_LABELS[policy.expenseType] : "All expense types"} />
          <Chip size="small" variant="outlined" label={scope} />
        </Stack>

        <Divider />
        <PolicyRuleList rules={policy.rules} dense />

        <Button
          variant="outlined"
          onClick={() => onView(policy)}
          sx={{ alignSelf: "flex-start", mt: "auto" }}
        >
          View policy
        </Button>
      </CardContent>
    </Card>
  );
}
