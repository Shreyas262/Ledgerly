import type { CollectionQuery, CollectionQueryResult } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import { baseApi } from "../../../services/api/baseApi";
import type { UserActivity } from "../types/activity";

export const activityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getActivity: builder.query<CollectionQueryResult<UserActivity>, CollectionQuery | void>({
      query: (query) => `/activity${buildCollectionQuery(query ?? undefined)}`,
      providesTags: ["Activity"],
    }),
  }),
});

export const { useGetActivityQuery } = activityApi;
