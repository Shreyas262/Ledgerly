import type { CollectionQuery, CollectionQueryResult } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import { baseApi } from "../../../services/api/baseApi";
import type { AuditEvent } from "../types/audit";

export const auditApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAuditEvents: builder.query<CollectionQueryResult<AuditEvent>, CollectionQuery | void>({
      query: (query) => `/audit-logs${buildCollectionQuery(query ?? undefined)}`,
      transformResponse: (response: CollectionQueryResult<AuditEvent>) => response,
      providesTags: ["Audit"],
    }),

    getAuditEventById: builder.query<AuditEvent, string>({
      query: (id) => `/audit-logs/${id}`,
      transformResponse: (response: { data: AuditEvent }) => response.data,
      providesTags: (_result, _error, id) => [{ type: "Audit", id }],
    }),
  }),
});

export const {
  useGetAuditEventsQuery,
  useGetAuditEventByIdQuery,
} = auditApi;
