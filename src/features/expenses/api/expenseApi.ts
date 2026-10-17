import type { CollectionQuery, CollectionQueryResult } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import { baseApi } from "../../../services/api/baseApi";
import type { BulkSubmitResult, CreateExpenseRequest, Expense, ExpenseScope, UpdateExpenseRequest } from "../types/expense";
import type { ExpenseComment, ExpenseCommentThread } from "../types/comment";

export interface GetExpensesArgs {
  scope: ExpenseScope;
  query?: CollectionQuery;
}

/**
 * Every view an expense change can affect: the expense itself, the lists and
 * queues it appears in, and the summaries built from it. Steps from approval
 * onward also refresh budgets.
 */
const expenseChangeTags = (id: string, { budgets = false } = {}) => [
  { type: "Expense" as const, id },
  // Whether the thread takes new comments depends on the status.
  { type: "ExpenseComment" as const, id },
  { type: "Expense" as const, id: "LIST" },
  { type: "Expense" as const, id: "APPROVAL_QUEUE" },
  { type: "Expense" as const, id: "REIMBURSEMENT_QUEUE" },
  { type: "Dashboard" as const, id: "SUMMARY" },
  { type: "Analytics" as const, id: "SUMMARY" },
  ...(budgets ? ["Budgets" as const] : []),
];

export const expensesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExpenses: builder.query<CollectionQueryResult<Expense>, GetExpensesArgs>({
      query: ({ scope, query }) => {
        const queryString = buildCollectionQuery(query);
        return `/expenses${queryString}${queryString ? "&" : "?"}scope=${scope}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({
                type: "Expense" as const,
                id,
              })),
              {
                type: "Expense" as const,
                id: "LIST",
              },
            ]
          : [
              {
                type: "Expense" as const,
                id: "LIST",
              },
            ],
    }),

    getExpenseById: builder.query<Expense, string>({
      query: (id) => `/expenses/${id}`,

      providesTags: (_result, _error, id) => [
        {
          type: "Expense",
          id,
        },
      ],
    }),

    createExpense: builder.mutation<Expense, CreateExpenseRequest>({
      query: (expense) => ({
        url: "/expenses",
        method: "POST",
        body: expense,
      }),

      invalidatesTags: [
        { type: "Expense", id: "LIST" },
        { type: "Dashboard", id: "SUMMARY" },
        { type: "Analytics", id: "SUMMARY" },
      ],
    }),

    updateExpense: builder.mutation<Expense, UpdateExpenseRequest>({
      query: ({ id, ...body }) => ({
        url: `/expenses/${id}`,
        method: "PUT",
        body,
      }),

      invalidatesTags: (_result, _error, { id }) => expenseChangeTags(id),
    }),

    submitExpense: builder.mutation<Expense, string>({
      query: (id) => ({
        url: `/expenses/${id}/submit`,
        method: "POST",
      }),

      invalidatesTags: (_result, _error, id) => expenseChangeTags(id),
    }),

    // Results come back per draft; every draft sent may have changed.
    bulkSubmitExpenses: builder.mutation<BulkSubmitResult[], string[]>({
      query: (expenseIds) => ({
        url: "/expenses/bulk-submit",
        method: "POST",
        body: { expenseIds },
      }),
      transformResponse: (response: { results: BulkSubmitResult[] }) => response.results,
      invalidatesTags: (_result, _error, expenseIds) => expenseIds.flatMap((id) => expenseChangeTags(id)),
    }),

    startExpenseReview: builder.mutation<Expense, string>({
      query: (id) => ({
        url: `/expenses/${id}/review`,
        method: "POST",
      }),

      invalidatesTags: (_result, _error, id) => expenseChangeTags(id),
    }),
    
    approveExpense: builder.mutation<Expense, string>({
      query: (id) => ({
        url: `/expenses/${id}/approve`,
        method: "POST",
      }),

      invalidatesTags: (_result, _error, id) => expenseChangeTags(id, { budgets: true }),
    }),

    restoreExpense: builder.mutation<Expense, string>({
      query: (id) => ({
        url: `/expenses/${id}/restore`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, id) => expenseChangeTags(id),
    }),

    startReimbursement: builder.mutation<Expense, string>({
      query: (id) => ({
        url: `/expenses/${id}/start-reimbursement`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, id) => expenseChangeTags(id, { budgets: true }),
    }),

    reimburseExpense: builder.mutation<Expense, string>({
      query: (id) => ({
        url: `/expenses/${id}/reimburse`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, id) => expenseChangeTags(id, { budgets: true }),
    }),

    cancelExpense: builder.mutation<Expense, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/expenses/${id}/cancel`,
        method: "POST",
        body: reason ? { reason } : {},
      }),
      invalidatesTags: (_result, _error, { id }) => expenseChangeTags(id, { budgets: true }),
    }),

    rejectExpense: builder.mutation<Expense,{id: string; reason: string;}>({
      query: ({ id, reason }) => ({
        url: `/expenses/${id}/reject`,
        method: "POST",
        body: {
          reason,
        },
      }),

      invalidatesTags: (_result, _error, { id }) => expenseChangeTags(id),
    }),

    getExpenseComments: builder.query<ExpenseCommentThread, string>({
      query: (id) => `/expenses/${id}/comments`,
      providesTags: (_result, _error, id) => [{ type: "ExpenseComment", id }],
    }),

    addExpenseComment: builder.mutation<ExpenseComment, { id: string; body: string }>({
      query: ({ id, body }) => ({
        url: `/expenses/${id}/comments`,
        method: "POST",
        body: { body },
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "ExpenseComment", id }],
    }),
  }),
});

export const {
  useGetExpensesQuery,
  useGetExpenseByIdQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useSubmitExpenseMutation,
  useBulkSubmitExpensesMutation,
  useStartExpenseReviewMutation,
  useRestoreExpenseMutation,
  useStartReimbursementMutation,
  useReimburseExpenseMutation,
  useCancelExpenseMutation,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
  useGetExpenseCommentsQuery,
  useAddExpenseCommentMutation,
} = expensesApi;
