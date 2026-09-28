import { useDeferredValue, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AddOutlined, AttachFileOutlined } from "@mui/icons-material";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";

import { PageHeader } from "../../../components/common/PageHeader";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { RefreshingState } from "../../../components/common/RefreshingState";
import { Amount } from "../../../components/common/Amount";
import { formatDate } from "../../../utils/format";
import { useGetPersonalExpensesQuery } from "../api/personalApi";
import {
  PAYMENT_METHOD_LABELS,
  PERSONAL_EXPENSE_TYPE_LABELS,
  initialPersonalExpenseFilters,
  type PersonalExpenseFilter,
} from "../types/personal";
import { PersonalExpenseFilters } from "../components/PersonalExpenseFilters";

const PAGE_SIZE = 10;

export function PersonalExpensesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);
  const [filters, setFilters] = useState<PersonalExpenseFilter>(initialPersonalExpenseFilters);
  const [page, setPage] = useState(1);
  // Typing in the search box should not send a request per keystroke.
  const search = useDeferredValue(filters.search.trim());
  const rangeInvalid = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);

  const { data, isLoading, isFetching, isError, error, refetch } = useGetPersonalExpensesQuery(
    {
      search: search || undefined,
      filter: {
        ...(filters.type !== "all" ? { type: filters.type } : {}),
        ...(filters.paymentMethod !== "all" ? { paymentMethod: filters.paymentMethod } : {}),
      },
      from: rangeInvalid ? undefined : filters.dateFrom || undefined,
      to: rangeInvalid ? undefined : filters.dateTo || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    { refetchOnMountOrArgChange: true },
  );

  const changeFilters = (next: PersonalExpenseFilter) => {
    setFilters(next);
    setPage(1);
  };
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(initialPersonalExpenseFilters);
  const expenses = data?.data ?? [];

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Expenses"
        description="Everything you have spent, newest first."
        actions={
          <Button component={RouterLink} to="/personal/expenses/new" variant="contained" startIcon={<AddOutlined />}>
            Add Expense
          </Button>
        }
      />

      <PersonalExpenseFilters
        filters={filters}
        onChange={changeFilters}
        onReset={() => changeFilters(initialPersonalExpenseFilters)}
      />

      {isLoading ? (
        <LoadingState message="Loading expenses…" />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : expenses.length === 0 ? (
        <Paper>
          {isFiltered ? (
            <EmptyState
              title="No matching expenses"
              message="Try a different search or clear the filters."
              action={<Button onClick={() => changeFilters(initialPersonalExpenseFilters)}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              title="No expenses yet"
              message="Add your first expense to start tracking where your money goes."
              action={
                <Button component={RouterLink} to="/personal/expenses/new" variant="contained" startIcon={<AddOutlined />}>
                  Add Expense
                </Button>
              }
            />
          )}
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {isFetching && <RefreshingState />}
          <Typography variant="body2" color="text.secondary">
            {data!.total} {data!.total === 1 ? "expense" : "expenses"}
          </Typography>
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow
                    key={expense.id}
                    hover
                    onClick={() => navigate(`/personal/expenses/${expense.id}`)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(expense.expenseDate)}</TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Box
                          component={RouterLink}
                          to={`/personal/expenses/${expense.id}`}
                          onClick={(event) => event.stopPropagation()}
                          sx={{ color: "text.primary", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {expense.description}
                        </Box>
                        {expense.documentIds.length > 0 && (
                          <AttachFileOutlined fontSize="small" color="action" aria-label="Has receipts" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={PERSONAL_EXPENSE_TYPE_LABELS[expense.type]} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{PAYMENT_METHOD_LABELS[expense.paymentMethod]}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Amount value={expense.amount} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {data!.total > PAGE_SIZE && (
            <Stack sx={{ alignItems: "center" }}>
              <Pagination
                page={page}
                count={Math.ceil(data!.total / PAGE_SIZE)}
                onChange={(_event, next) => setPage(next)}
                color="primary"
              />
            </Stack>
          )}
        </Stack>
      )}

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={3000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setNotice(null)}>{notice}</Alert>
      </Snackbar>
    </Stack>
  );
}
