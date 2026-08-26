import { Alert, CircularProgress, Stack, Typography } from "@mui/material";

import { useGetExpensesQuery } from "../api/expenseApi";

export function ExpenseApiTest() {
    const { data, isLoading, isError, error } = useGetExpensesQuery({});

  if (isLoading) {
    return <CircularProgress />;
  }

  if (isError) {
    console.error(error);

    return <Alert severity="error">Failed to load expenses.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">
        Expenses: {data?.total ?? 0}
      </Typography>

      {data?.data.map((expense) => (
        <Typography key={expense.id}>
          {expense.merchant} — {expense.amount} {expense.currency}
        </Typography>
      ))}
    </Stack>
  );
}