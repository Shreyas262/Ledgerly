import { Box, Button, Card, CardContent, Divider, List, ListItemButton, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import type { DashboardRecentExpense } from "../types/dashboard";
import { EXPENSE_TYPE_LABELS } from "../../expenses/types/expense";
import { ExpenseStatusChip } from "../../expenses/components/ExpenseStatusChip";
import { ConversionNote } from "../../currency/components/ConversionNote";
import { Amount } from "../../../components/common/Amount";
import { TruncatedText } from "../../../components/common/TruncatedText";
import { formatDate } from "../../../utils/format";

/** The user's latest expenses with their status, whatever the date range. */
export function RecentExpenses({ expenses }: { expenses: DashboardRecentExpense[] }) {
  return (
    <Card component="section" aria-labelledby="recent-expenses-title">
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography id="recent-expenses-title" variant="h6">Recent expenses</Typography>
          {expenses.length > 0 && (
            <Button component={RouterLink} to="/expenses" size="small">View All</Button>
          )}
        </Stack>
        {expenses.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 1 }}>You have not created any expenses yet.</Typography>
        ) : (
          <List component="div" disablePadding>
            {expenses.map((expense, index) => (
              <Box key={expense.id}>
                {index > 0 && <Divider />}
                <ListItemButton component={RouterLink} to={`/expenses/${expense.id}`} sx={{ px: 1, gap: 2, borderRadius: 1 }}>
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <TruncatedText variant="subtitle2">{expense.title}</TruncatedText>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(expense.expenseDate)} · {EXPENSE_TYPE_LABELS[expense.type] ?? expense.type}
                    </Typography>
                  </Stack>
                  <Box sx={{ flexShrink: 0, textAlign: "right" }}>
                    <Typography variant="subtitle2"><Amount value={expense.amount} /></Typography>
                    <ConversionNote conversion={expense.conversion} />
                  </Box>
                  <Box sx={{ flexShrink: 0 }}>
                    <ExpenseStatusChip status={expense.status} />
                  </Box>
                </ListItemButton>
              </Box>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
