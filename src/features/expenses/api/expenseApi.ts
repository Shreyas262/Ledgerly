import { baseApi } from "../../../services/api/baseApi";
import type { CreateExpenseRequest, Expense, UpdateExpenseRequest } from "../../../types/expense";

export const expensesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExpenses: builder.query<Expense[], void>({
      query: () => "/expenses",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({
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

      invalidatesTags: [{ type: "Expense", id: "LIST" }],
    }),

    updateExpense: builder.mutation<Expense, UpdateExpenseRequest>({
      query: ({ id, ...body }) => ({
        url: `/expenses/${id}`,
        method: "PUT",
        body,
      }),

      invalidatesTags: (_result, _error, { id }) => [
        { type: "Expense", id },
        { type: "Expense", id: "LIST" },
      ],
    }),

    submitExpense: builder.mutation<Expense, string>({
      query: (id) => ({
        url: `/expenses/${id}/submit`,
        method: "POST",
      }),

      invalidatesTags: (_result, _error, id) => [
        {
          type: "Expense",
          id,
        },
        {
          type: "Expense",
          id: "LIST",
        },
      ],
    }),

    startExpenseReview: builder.mutation<Expense, string>({
      query: (id) => ({
        url: `/expenses/${id}/review`,
        method: "POST",
      }),

      invalidatesTags: (_result, _error, id) => [
        {
          type: "Expense",
          id,
        },
        {
          type: "Expense",
          id: "LIST",
        },
      ],
    }),
    
    approveExpense: builder.mutation<Expense, string>({
      query: (id) => ({
        url: `/expenses/${id}/approve`,
        method: "POST",
      }),

      invalidatesTags: (_result, _error, id) => [
        {
          type: "Expense",
          id,
        },
        {
          type: "Expense",
          id: "LIST",
        },
      ],
    }),

    rejectExpense: builder.mutation<Expense,{id: string; reason: string;}>({
      query: ({ id, reason }) => ({
        url: `/expenses/${id}/reject`,
        method: "POST",
        body: {
          reason,
        },
      }),

      invalidatesTags: (_result, _error, { id }) => [
        {
          type: "Expense",
          id,
        },
        {
          type: "Expense",
          id: "LIST",
        },
      ],
    }),
  }),
});

export const {
  useGetExpensesQuery,
  useGetExpenseByIdQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useSubmitExpenseMutation,
  useStartExpenseReviewMutation,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
} = expensesApi;