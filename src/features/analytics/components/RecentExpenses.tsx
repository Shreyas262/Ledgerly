import {
  Box,
  Stack,
  Typography,
} from "@mui/material";

import { expenses } from "../../../mocks/data/expenses";
import { StatusBadge } from "../../../components/common/statusBadge/StatusBadge";

export function RecentExpenses() {
  const recentExpenses = expenses.slice(0, 5);

  return (
    <Stack spacing={1}>
      {recentExpenses.map((expense) => (
        <Box
          key={expense.id}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Stack spacing={0.25}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {expense.merchant}
            </Typography>

            <Typography variant="caption" color="text.secondary">
              {expense.category}
            </Typography>
          </Stack>

          <Stack
            direction="row"
            spacing={2}
            sx={{alignItems: "center"}}
          >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {expense.amount.toLocaleString("en-IN")}{" "}
              {expense.currency}
            </Typography>

            <StatusBadge status={expense.status} />
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}