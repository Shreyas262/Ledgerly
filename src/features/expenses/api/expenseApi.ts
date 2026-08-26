import { baseApi } from "../../../services/api/baseApi";
import type {
  GetExpensesParams,
  ApiListResponse,
} from "../../../types/api";
import type { Expense } from "../../../types/expense";

export const expenseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExpenses: builder.query<ApiListResponse<Expense>, GetExpensesParams>({
      query: (params) => ({
        url: "/expenses",
        params,
      }),
      providesTags: ["Expense"],
    }),
  }),
});

export const { useGetExpensesQuery } = expenseApi;