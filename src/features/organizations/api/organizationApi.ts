import type { CollectionQuery } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import { baseApi } from "../../../services/api/baseApi";
import type { ID } from "../../../types/common";
import type { Department, Organization, Team } from "../types/organization";

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
      // Members follow the team into its department.
      invalidatesTags: ["Teams", "Users", "User"],
    }),
    deleteTeam: builder.mutation<void, ID>({
      query: (id) => ({ url: `/teams/${id}`, method: "DELETE" }),
      invalidatesTags: ["Teams"],
    }),
    addTeamMember: builder.mutation<unknown, { teamId: ID; userId: ID }>({
      query: ({ teamId, userId }) => ({ url: `/teams/${teamId}/members`, method: "POST", body: { userId } }),
      invalidatesTags: ["Users", "User", "Teams"],
    }),
    setDepartmentFinanceUsers: builder.mutation<unknown, { departmentId: ID; userIds: ID[] }>({
      query: ({ departmentId, userIds }) => ({ url: `/departments/${departmentId}/finance-users`, method: "PUT", body: { userIds } }),
      invalidatesTags: ["Users", "User", "Departments"],
    }),
  }),
});

export const {
  useGetOrganizationQuery,
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetTeamsQuery,
  useCreateTeamMutation,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
  useAddTeamMemberMutation,
  useSetDepartmentFinanceUsersMutation,
} = organizationApi;
