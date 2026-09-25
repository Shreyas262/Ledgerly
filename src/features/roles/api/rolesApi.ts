import type { CollectionQuery } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import { baseApi } from "../../../services/api/baseApi";

import type { Role, CreateRolePayload, UpdateRolePayload } from "../types/role";
import type { ID } from "../../../types/common";

export const rolesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRoles: builder.query<Role[], CollectionQuery | void>({
      query: (query) => `/roles${buildCollectionQuery(query ?? undefined)}`,
      providesTags: ["Roles"],
    }),
    createRole: builder.mutation<Role, CreateRolePayload>({
      query: (role) => ({
        url: "/roles",
        method: "POST",
        body: role,
      }),
      invalidatesTags: ["Roles"]
    }),
    updateRole: builder.mutation<Role, {id: ID, data: UpdateRolePayload}>({
      query: ({id, data}) => ({
        url: `/roles/${id}`,
        method: "PUT",
        body: data,
      }),
      // Role permissions are the users' effective permissions.
      invalidatesTags: ["Roles", "Users", "User"],
    }),
    deleteRole: builder.mutation<void, ID>({
      query: (id) => ({
        url: `/roles/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Roles", "Users"],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useUpdateRoleMutation,
} = rolesApi;