import type { CollectionQuery } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import { baseApi } from "../../../services/api/baseApi";

import type {
  ApplicablePolicy,
  CreateExpensePolicyRequest,
  ExpensePolicy,
  PolicyPreviewRequest,
  PolicyPreviewResult,
  UpdateExpensePolicyRequest,
} from "../types/policy";
import type { ExpenseType } from "../../expenses/types/expense";

export const policiesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPolicies: builder.query<
      ExpensePolicy[],
      CollectionQuery | void
    >({
      query: (query) => `/policies${buildCollectionQuery(query ?? undefined)}`,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({
                type: "Policies" as const,
                id,
              })),
              {
                type: "Policies" as const,
                id: "LIST",
              },
            ]
          : [
              {
                type: "Policies" as const,
                id: "LIST",
              },
            ],
    }),

    getPolicyById: builder.query<
      ExpensePolicy,
      string
    >({
      query: (id) => `/policies/${id}`,
      providesTags: (_result, _error, id) => [
        {
          type: "Policies",
          id,
        },
      ],
    }),

    createPolicy: builder.mutation<
      ExpensePolicy,
      CreateExpensePolicyRequest
    >({
      query: (body) => ({
        url: "/policies",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        {
          type: "Policies",
          id: "LIST",
        },
        { type: "Policies", id: "APPLICABLE" },
      ],
    }),

    updatePolicy: builder.mutation<
      ExpensePolicy,
      UpdateExpensePolicyRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/policies/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        {
          type: "Policies",
          id,
        },
        {
          type: "Policies",
          id: "LIST",
        },
        { type: "Policies", id: "APPLICABLE" },
      ],
    }),

    /** The policy that applies to the caller for an expense type (§21.12). */
    getApplicablePolicy: builder.query<
      ApplicablePolicy,
      { type: ExpenseType; date?: string; excludeExpenseId?: string }
    >({
      query: (params) => ({ url: "/policies/applicable", params }),
      providesTags: [{ type: "Policies", id: "APPLICABLE" }],
    }),

    /** Simulates the applicable policy for a hypothetical expense (§21.13). */
    previewPolicy: builder.mutation<PolicyPreviewResult, PolicyPreviewRequest>({
      query: (body) => ({ url: "/policies/preview", method: "POST", body }),
    }),
  }),
});

export const {
  useGetPoliciesQuery,
  useGetPolicyByIdQuery,
  useCreatePolicyMutation,
  useUpdatePolicyMutation,
  useGetApplicablePolicyQuery,
  usePreviewPolicyMutation,
} = policiesApi;