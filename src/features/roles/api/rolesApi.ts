import { baseApi } from "../../../services/api/baseApi";

import type { Role, CreateRolePayload, UpdateRolePayload } from "../../../types/auth";
import type { ID } from "../../../types/common";

export const rolesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRoles: builder.query<Role[], void>({
      query: () => "/roles",
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
      invalidatesTags: ["Roles"],
    }),
    deleteRole: builder.mutation<void, ID>({
      query: (id) => ({
        url: `/roles/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Roles"],
    }),
  }),
});

export const {
  useGetRolesQuery,
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useUpdateRoleMutation,
} = rolesApi;