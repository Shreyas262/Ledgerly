import { baseApi } from "../../../services/api/baseApi";
import type { DashboardSummary } from "../types/dashboard";

export interface DashboardQuery {
  from?: string;
  to?: string;
}

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardSummary: builder.query<DashboardSummary, DashboardQuery | void>({
      query: (query) => ({
        url: "/dashboard/summary",
        params: query ?? undefined,
      }),
      providesTags: [{ type: "Dashboard", id: "SUMMARY" }],
    }),
  }),
});

export const { useGetDashboardSummaryQuery } = dashboardApi;
