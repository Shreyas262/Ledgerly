import { baseApi } from "../../../services/api/baseApi";
import type { AuditLog } from "../../../types/audit";

export const auditApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAuditLogs: builder.query<AuditLog[], void>({
      query: () => "/audit-logs",
      transformResponse: (response: {
        data: AuditLog[];
      }) => response.data,
      providesTags: ["Audit"],
    }),

    getAuditLogById: builder.query<AuditLog, string>({
      query: (id) => `/audit-logs/${id}`,
      transformResponse: (response: {
        data: AuditLog;
      }) => response.data,
      providesTags: ["Audit"],
    }),
  }),
});

export const {
  useGetAuditLogsQuery,
  useGetAuditLogByIdQuery,
} = auditApi;