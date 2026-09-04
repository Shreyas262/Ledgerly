import { baseApi } from "../../../services/api/baseApi";

import type {
  CreateExpensePolicyRequest,
  ExpensePolicy,
  UpdateExpensePolicyRequest,
} from "../../../types/policy";

export const policiesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPolicies: builder.query<
      ExpensePolicy[],
      void
    >({
      query: () => "/policies",
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
      ],
    }),
  }),
});

export const {
  useGetPoliciesQuery,
  useGetPolicyByIdQuery,
  useCreatePolicyMutation,
  useUpdatePolicyMutation,
} = policiesApi;