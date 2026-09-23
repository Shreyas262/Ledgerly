import { baseApi } from "../../../services/api/baseApi";
import type { ApiResponse } from "../../../types/api";
import type { LoginRequest } from "../types/requests";
import type { AuthSession, AuthUser } from "../types/auth";
import { clearSessionCookie, setSessionCookie } from "../../../mocks/sessionCookie";

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<ApiResponse<AuthSession>, LoginRequest>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          setSessionCookie(data.data.sessionId, data.data.expiresAt);
        } catch {
          // Login errors are handled by the mutation state.
        }
      },
      invalidatesTags: ["User"],
    }),

    logout: builder.mutation<ApiResponse<null>, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          clearSessionCookie();
        }
      },
    }),

    getCurrentUser: builder.query<ApiResponse<AuthUser>, void>({
      query: () => "/auth/me",
      providesTags: ["User"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch {
          clearSessionCookie();
        }
      },
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetCurrentUserQuery,
} = authApi;
