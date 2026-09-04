import {
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import type { ExpensePolicy } from "../../../types/policy";

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
              <Typography variant="h6">
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
              label={policy.status}
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
              ₹
              {policy.approvalLimit.toLocaleString(
                "en-IN",
              )}
            </Typography>
          </Stack>

          <Typography
            component="button"
            onClick={() => onView(policy)}
            sx={{
              border: 0,
              background: "none",
              padding: 0,
              textAlign: "left",
              cursor: "pointer",
              color: "primary.main",
              font: "inherit",
            }}
          >
            View policy
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}