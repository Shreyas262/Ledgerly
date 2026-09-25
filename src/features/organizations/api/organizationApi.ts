import type { CollectionQuery } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import { baseApi } from "../../../services/api/baseApi";
import type { ID } from "../../../types/common";
import type { Department, Organization, Team } from "../types/organization";

export interface OrganizationUpdatePayload {
  name: string;
  status: Organization["status"];
}

export interface DepartmentPayload {
  name: string;
  status?: Department["status"];
}

export interface TeamPayload {
  departmentId: ID;
  name: string;
  status?: Team["status"];
}

export const organizationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOrganization: builder.query<Organization, void>({
      query: () => "/organization",
      providesTags: ["Organization"],
    }),
    updateOrganization: builder.mutation<Organization, OrganizationUpdatePayload>({
      query: (body) => ({ url: "/organization", method: "PUT", body }),
      invalidatesTags: ["Organization"],
    }),
    getDepartments: builder.query<Department[], CollectionQuery | void>({
      query: (query) => `/departments${buildCollectionQuery(query ?? undefined)}`,
      providesTags: ["Departments"],
    }),
    createDepartment: builder.mutation<Department, DepartmentPayload>({
      query: (body) => ({ url: "/departments", method: "POST", body }),
      invalidatesTags: ["Departments", "Teams"],
    }),
    updateDepartment: builder.mutation<Department, { id: ID; body: DepartmentPayload }>({
      query: ({ id, body }) => ({ url: `/departments/${id}`, method: "PUT", body }),
      invalidatesTags: ["Departments", "Teams"],
    }),
    deleteDepartment: builder.mutation<void, ID>({
      query: (id) => ({ url: `/departments/${id}`, method: "DELETE" }),
      invalidatesTags: ["Departments"],
    }),
    getTeams: builder.query<Team[], CollectionQuery | void>({
      query: (query) => `/teams${buildCollectionQuery(query ?? undefined)}`,
      providesTags: ["Teams"],
    }),
    createTeam: builder.mutation<Team, TeamPayload>({
      query: (body) => ({ url: "/teams", method: "POST", body }),
      invalidatesTags: ["Teams"],
    }),
    updateTeam: builder.mutation<Team, { id: ID; body: TeamPayload }>({
      query: ({ id, body }) => ({ url: `/teams/${id}`, method: "PUT", body }),
      invalidatesTags: ["Teams"],
    }),
    deleteTeam: builder.mutation<void, ID>({
      query: (id) => ({ url: `/teams/${id}`, method: "DELETE" }),
      invalidatesTags: ["Teams"],
    }),
  }),
});

export const {
  useGetOrganizationQuery,
  useUpdateOrganizationMutation,
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetTeamsQuery,
  useCreateTeamMutation,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
} = organizationApi;
