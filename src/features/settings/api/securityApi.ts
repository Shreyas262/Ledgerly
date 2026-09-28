import { baseApi } from "../../../services/api/baseApi";

export interface SessionSummary {
  current: { createdAt: string; expiresAt: string } | null;
  otherActiveSessions: number;
}

export const securityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** The current session and how many other sessions are active (§16.4). */
    getSessions: builder.query<SessionSummary, void>({
      query: () => "/auth/sessions",
      transformResponse: (response: { data: SessionSummary }) => response.data,
      providesTags: [{ type: "User", id: "SESSIONS" }],
    }),
    changePassword: builder.mutation<{ revokedSessions: number }, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: "/auth/me/password", method: "PUT", body }),
      transformResponse: (response: { data: { revokedSessions: number } }) => response.data,
      invalidatesTags: [{ type: "User", id: "SESSIONS" }, "Activity"],
    }),
    revokeOtherSessions: builder.mutation<{ revokedSessions: number }, void>({
      query: () => ({ url: "/auth/sessions/revoke-others", method: "POST" }),
      transformResponse: (response: { data: { revokedSessions: number } }) => response.data,
      invalidatesTags: [{ type: "User", id: "SESSIONS" }, "Activity"],
    }),
  }),
});

export const {
  useGetSessionsQuery,
  useChangePasswordMutation,
  useRevokeOtherSessionsMutation,
} = securityApi;
