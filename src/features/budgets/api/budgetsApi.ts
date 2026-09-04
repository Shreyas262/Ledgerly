import { baseApi } from "../../../services/api/baseApi";

import type {
  Budget,
  CreateBudgetRequest,
  UpdateBudgetRequest,
} from "../../../types/budget";

export const budgetsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBudgets: builder.query<Budget[], void>({
      query: () => "/budgets",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({
                type: "Budgets" as const,
                id,
              })),
              {
                type: "Budgets" as const,
                id: "LIST",
              },
            ]
          : [
              {
                type: "Budgets" as const,
                id: "LIST",
              },
            ],
    }),

    getBudgetById: builder.query<Budget, string>({
      query: (id) => `/budgets/${id}`,
      providesTags: (_result, _error, id) => [
        {
          type: "Budgets",
          id,
        },
      ],
    }),

    createBudget: builder.mutation<
      Budget,
      CreateBudgetRequest
    >({
      query: (body) => ({
        url: "/budgets",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        {
          type: "Budgets",
          id: "LIST",
        },
      ],
    }),

    updateBudget: builder.mutation<
      Budget,
      UpdateBudgetRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/budgets/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        {
          type: "Budgets",
          id,
        },
        {
          type: "Budgets",
          id: "LIST",
        },
      ],
    }),
  }),
});

export const {
  useGetBudgetsQuery,
  useGetBudgetByIdQuery,
  useCreateBudgetMutation,
  useUpdateBudgetMutation,
} = budgetsApi;