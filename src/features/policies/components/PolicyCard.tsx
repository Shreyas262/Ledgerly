import {
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import type { ExpensePolicy } from "../types/policy";
import { Amount } from "../../../components/common/Amount";
import { humanize } from "../../../utils/format";

interface PolicyCardProps {
  policy: ExpensePolicy;
  onView: (policy: ExpensePolicy) => void;
}

export function PolicyCard({
  policy,
  onView,
}: PolicyCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 2,
            }}
          >
            <Stack spacing={0.5}>
              <Typography variant="subtitle1">
                {policy.name}
              </Typography>

              {policy.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  {policy.description}
                </Typography>
              )}
            </Stack>

            <Chip
              label={humanize(policy.status)}
              color={policy.status === "active" ? "success" : "default"}
              size="small"
            />
          </Stack>

          <Stack spacing={0.5}>
            <Typography
              variant="body2"
              color="text.secondary"
            >
              Approval limit
            </Typography>

            <Typography variant="h5">
              <Amount value={policy.approvalLimit} />
            </Typography>
          </Stack>

          <Button
            size="small"
            onClick={() => onView(policy)}
            sx={{ alignSelf: "flex-start" }}
          >
            View policy
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}