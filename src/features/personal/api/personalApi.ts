import type { CollectionQuery, CollectionQueryResult } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import { baseApi } from "../../../services/api/baseApi";
import type {
  PersonalAnalytics,
  PersonalBudgetRequest,
  PersonalBudgetWithUsage,
  PersonalDocument,
  PersonalExpense,
  PersonalExpenseRequest,
  PersonalSummary,
} from "../types/personal";

// Summary, analytics and budget usage are derived from expenses, so any
// expense change refreshes them.
const INSIGHTS = { type: "PersonalInsights" as const, id: "ALL" };
const EXPENSE_LIST = { type: "PersonalExpense" as const, id: "LIST" };
const BUDGET_LIST = { type: "PersonalBudget" as const, id: "LIST" };

export const personalApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPersonalExpenses: builder.query<CollectionQueryResult<PersonalExpense>, CollectionQuery | void>({
      query: (query) => `/personal/expenses${buildCollectionQuery(query ?? undefined)}`,
      providesTags: (result) => [
        ...(result?.data.map(({ id }) => ({ type: "PersonalExpense" as const, id })) ?? []),
        EXPENSE_LIST,
      ],
    }),
    getPersonalExpense: builder.query<PersonalExpense, string>({
      query: (id) => `/personal/expenses/${id}`,
      providesTags: (_result, _error, id) => [{ type: "PersonalExpense", id }],
    }),
    createPersonalExpense: builder.mutation<PersonalExpense, PersonalExpenseRequest>({
      query: (body) => ({ url: "/personal/expenses", method: "POST", body }),
      invalidatesTags: [EXPENSE_LIST, BUDGET_LIST, INSIGHTS, "Activity"],
    }),
    updatePersonalExpense: builder.mutation<PersonalExpense, PersonalExpenseRequest & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/personal/expenses/${id}`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "PersonalExpense", id },
        EXPENSE_LIST,
        BUDGET_LIST,
        INSIGHTS,
        "Activity",
      ],
    }),
    deletePersonalExpense: builder.mutation<void, string>({
      query: (id) => ({ url: `/personal/expenses/${id}`, method: "DELETE" }),
      invalidatesTags: [EXPENSE_LIST, BUDGET_LIST, INSIGHTS, "Activity"],
    }),

    getPersonalDocuments: builder.query<PersonalDocument[], string>({
      query: (expenseId) => `/personal/expenses/${expenseId}/documents`,
      providesTags: (_result, _error, expenseId) => [{ type: "PersonalDocument", id: `EXPENSE-${expenseId}` }],
    }),
    uploadPersonalDocument: builder.mutation<PersonalDocument, { expenseId: string; file: File }>({
      query: ({ expenseId, file }) => {
        const body = new FormData();
        body.append("file", file);
        return { url: `/personal/expenses/${expenseId}/documents`, method: "POST", body };
      },
      invalidatesTags: (_result, _error, { expenseId }) => [
        { type: "PersonalDocument", id: `EXPENSE-${expenseId}` },
        { type: "PersonalExpense", id: expenseId },
        EXPENSE_LIST,
        "Activity",
      ],
    }),
    removePersonalDocument: builder.mutation<void, { id: string; expenseId: string }>({
      query: ({ id }) => ({ url: `/personal/documents/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { expenseId }) => [
        { type: "PersonalDocument", id: `EXPENSE-${expenseId}` },
        { type: "PersonalExpense", id: expenseId },
        EXPENSE_LIST,
        "Activity",
      ],
    }),
    // Returns a temporary object URL for preview; the binary is never kept in
    // the Redux cache and callers revoke the URL when done.
    fetchPersonalDocumentContent: builder.mutation<string, string>({
      query: (id) => ({
        url: `/personal/documents/${id}/content`,
        responseHandler: async (response) =>
          response.ok ? URL.createObjectURL(await response.blob()) : response.json(),
      }),
    }),

    getPersonalBudgets: builder.query<PersonalBudgetWithUsage[], void>({
      query: () => "/personal/budgets",
      providesTags: (result) => [
        ...(result?.map(({ id }) => ({ type: "PersonalBudget" as const, id })) ?? []),
        BUDGET_LIST,
      ],
    }),
    createPersonalBudget: builder.mutation<PersonalBudgetWithUsage, PersonalBudgetRequest>({
      query: (body) => ({ url: "/personal/budgets", method: "POST", body }),
      invalidatesTags: [BUDGET_LIST, INSIGHTS, "Activity"],
    }),
    updatePersonalBudget: builder.mutation<PersonalBudgetWithUsage, PersonalBudgetRequest & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/personal/budgets/${id}`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "PersonalBudget", id }, BUDGET_LIST, INSIGHTS, "Activity"],
    }),
    deletePersonalBudget: builder.mutation<void, string>({
      query: (id) => ({ url: `/personal/budgets/${id}`, method: "DELETE" }),
      invalidatesTags: [BUDGET_LIST, INSIGHTS, "Activity"],
    }),

    getPersonalSummary: builder.query<PersonalSummary, string | void>({
      query: (month) => `/personal/summary${month ? `?month=${month}` : ""}`,
      providesTags: [INSIGHTS],
    }),
    getPersonalAnalytics: builder.query<PersonalAnalytics, { from: string; to: string }>({
      query: ({ from, to }) => `/personal/analytics?from=${from}&to=${to}`,
      providesTags: [INSIGHTS],
    }),
  }),
});

export const {
  useGetPersonalExpensesQuery,
  useGetPersonalExpenseQuery,
  useCreatePersonalExpenseMutation,
  useUpdatePersonalExpenseMutation,
  useDeletePersonalExpenseMutation,
  useGetPersonalDocumentsQuery,
  useUploadPersonalDocumentMutation,
  useRemovePersonalDocumentMutation,
  useFetchPersonalDocumentContentMutation,
  useGetPersonalBudgetsQuery,
  useCreatePersonalBudgetMutation,
  useUpdatePersonalBudgetMutation,
  useDeletePersonalBudgetMutation,
  useGetPersonalSummaryQuery,
  useGetPersonalAnalyticsQuery,
} = personalApi;
