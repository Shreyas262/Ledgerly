import type { CollectionQuery } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import { baseApi } from "../../../services/api/baseApi";
import type {
  ActiveBudgetPeriod,
  OrganizationBudgetView,
  CreateOrganizationBudgetRequest,
  UpdateOrganizationBudgetRequest,
  UpsertDepartmentAllocationRequest,
  UpsertExpenseTypeBudgetRequest,
  UpsertTeamAllocationRequest,
} from "../types/budget";

export const budgetsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBudgets: builder.query<OrganizationBudgetView[], CollectionQuery | void>({
      query: (query) => `/budgets${buildCollectionQuery(query ?? undefined)}`,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Budgets" as const, id })),
              { type: "Budgets" as const, id: "LIST" },
            ]
          : [{ type: "Budgets" as const, id: "LIST" }],
    }),
    getBudgetById: builder.query<OrganizationBudgetView, string>({
      query: (id) => `/budgets/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Budgets", id }],
    }),
    createBudget: builder.mutation<
      OrganizationBudgetView,
      CreateOrganizationBudgetRequest
    >({
      query: (body) => ({ url: "/budgets", method: "POST", body }),
      invalidatesTags: [{ type: "Budgets", id: "LIST" }],
    }),
    updateBudget: builder.mutation<
      OrganizationBudgetView,
      UpdateOrganizationBudgetRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/budgets/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Budgets", id },
        { type: "Budgets", id: "LIST" },
        { type: "Budgets", id: "ACTIVE_PERIOD" },
      ],
    }),
    activateBudget: builder.mutation<OrganizationBudgetView, string>({
      query: (id) => ({ url: `/budgets/${id}/activate`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Budgets", id },
        { type: "Budgets", id: "LIST" },
        { type: "Budgets", id: "ACTIVE_PERIOD" },
      ],
    }),
    closeBudget: builder.mutation<OrganizationBudgetView, string>({
      query: (id) => ({ url: `/budgets/${id}/close`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Budgets", id },
        { type: "Budgets", id: "LIST" },
        { type: "Budgets", id: "ACTIVE_PERIOD" },
      ],
    }),
    reopenBudget: builder.mutation<OrganizationBudgetView, string>({
      query: (id) => ({ url: `/budgets/${id}/reopen`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Budgets", id },
        { type: "Budgets", id: "LIST" },
        { type: "Budgets", id: "ACTIVE_PERIOD" },
      ],
    }),
    rolloverBudget: builder.mutation<OrganizationBudgetView, { id: string; name: string; startDate: string; endDate: string }>({
      query: ({ id, ...body }) => ({ url: `/budgets/${id}/rollover`, method: "POST", body }),
      invalidatesTags: [{ type: "Budgets", id: "LIST" }],
    }),
    getActiveBudgetPeriod: builder.query<ActiveBudgetPeriod, void>({
      query: () => "/budgets/active-period",
      transformResponse: (response: {
        data: ActiveBudgetPeriod["period"];
        canCreateExpense: boolean;
        reason: string | null;
      }) => ({ period: response.data, canCreateExpense: response.canCreateExpense, reason: response.reason }),
      providesTags: [{ type: "Budgets", id: "ACTIVE_PERIOD" }],
    }),
    upsertDepartmentAllocation: builder.mutation<
      OrganizationBudgetView,
      UpsertDepartmentAllocationRequest
    >({
      query: ({ organizationBudgetId, ...body }) => ({
        url: `/budgets/${organizationBudgetId}/departments`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { organizationBudgetId }) => [
        { type: "Budgets", id: organizationBudgetId },
        { type: "Budgets", id: "LIST" },
        { type: "Budgets", id: "ACTIVE_PERIOD" },
      ],
    }),
    upsertTeamAllocation: builder.mutation<
      OrganizationBudgetView,
      UpsertTeamAllocationRequest
    >({
      query: ({ organizationBudgetId, ...body }) => ({
        url: `/budgets/${organizationBudgetId}/teams`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { organizationBudgetId }) => [
        { type: "Budgets", id: organizationBudgetId },
        { type: "Budgets", id: "LIST" },
        { type: "Budgets", id: "ACTIVE_PERIOD" },
      ],
    }),
    upsertExpenseTypeBudget: builder.mutation<
      OrganizationBudgetView,
      UpsertExpenseTypeBudgetRequest
    >({
      query: ({ organizationBudgetId, ...body }) => ({
        url: `/budgets/${organizationBudgetId}/expense-types`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { organizationBudgetId }) => [
        { type: "Budgets", id: organizationBudgetId },
        { type: "Budgets", id: "LIST" },
        { type: "Budgets", id: "ACTIVE_PERIOD" },
      ],
    }),
  }),
});

export const {
  useGetBudgetsQuery,
  useGetBudgetByIdQuery,
  useCreateBudgetMutation,
  useUpdateBudgetMutation,
  useActivateBudgetMutation,
  useCloseBudgetMutation,
  useUpsertDepartmentAllocationMutation,
  useUpsertExpenseTypeBudgetMutation,
  useUpsertTeamAllocationMutation,
  useReopenBudgetMutation,
  useRolloverBudgetMutation,
  useGetActiveBudgetPeriodQuery,
} = budgetsApi;
