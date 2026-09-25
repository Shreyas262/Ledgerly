import type { CollectionQuery, CollectionQueryResult } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import type {
  CreateUserPayload,
  UpdateUserPayload,
  User,
} from "../types/user";

import { baseApi } from "../../../services/api/baseApi";

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<CollectionQueryResult<User>, CollectionQuery | void>({
      query: (query) => `/users${buildCollectionQuery(query ?? undefined)}`,
      transformResponse: (response: CollectionQueryResult<User>) => response,
      providesTags: ["Users"],
    }),

    createUser: builder.mutation<
      User,
      CreateUserPayload
    >({
      query: (body) => ({
        url: "/users",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Users"],
    }),

    updateUser: builder.mutation<
      User,
      {
        id: string;
        body: UpdateUserPayload;
      }
    >({
      query: ({ id, body }) => ({
        url: `/users/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Users", "User"],
    }),

    updateUserStatus: builder.mutation<User, { id: string; status: "active" | "inactive" }>({
      query: ({ id, status }) => ({ url: `/users/${id}/status`, method: "PATCH", body: { status } }),
      invalidatesTags: ["Users", "User"],
    }),
    deleteUser: builder.mutation<void, string>({
      query: (id) => ({
        url: `/users/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Users"],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useUpdateUserStatusMutation,
} = usersApi;