import { baseApi } from "../../../services/api/baseApi";
import type { AnalyticsQuery, AnalyticsSummary } from "../types/analytics";

export const analyticsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAnalyticsSummary: builder.query<AnalyticsSummary, AnalyticsQuery | void>({
      query: (query) => ({ url: "/analytics/summary", params: query ?? undefined }),
      providesTags: [{ type: "Analytics", id: "SUMMARY" }],
    }),
  }),
});

export const { useGetAnalyticsSummaryQuery } = analyticsApi;
