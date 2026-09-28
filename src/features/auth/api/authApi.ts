import { baseApi } from "../../../services/api/baseApi";
import type { ApiResponse } from "../../../types/api";
import type { LoginRequest, RegisterPersonalRequest, UpdateProfileRequest } from "../types/requests";
import type { AuthSession, AuthUser } from "../types/auth";
import { clearSessionCookie, setSessionCookie } from "../../../services/auth/sessionCookie";

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

    // Creates a personal account; the user then signs in with it.
    registerPersonal: builder.mutation<ApiResponse<{ id: string; email: string }>, RegisterPersonalRequest>({
      query: (body) => ({
        url: "/auth/register",
        method: "POST",
        body,
      }),
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
      invalidatesTags: ["User"],
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

    updateCurrentUser: builder.mutation<ApiResponse<AuthUser>, UpdateProfileRequest>({
      query: (body) => ({
        url: "/auth/me",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["User", "Users", "Activity"],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterPersonalMutation,
  useLogoutMutation,
  useGetCurrentUserQuery,
  useUpdateCurrentUserMutation,
} = authApi;
