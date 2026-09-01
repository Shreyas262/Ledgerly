import { Button, Stack, Typography } from "@mui/material";

import { usePermissions } from "../../../features/auth/hooks/usePermissions";

export function ExpensesPage() {
  const { can } = usePermissions();

  return (
    <Stack spacing={3}>
      <Typography variant="h4">
        Expenses
      </Typography>

      {can("expenses.create") && (
        <Button variant="contained">
          Create Expense
        </Button>
      )}
    </Stack>
  );
}