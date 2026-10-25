import { baseApi } from "../../../services/api/baseApi";
import type {
  CreateDelegationRequest,
  DelegationCandidate,
  DelegationList,
  DelegationView,
} from "../types/delegation";

/**
 * Review delegation (§22.12). Creating or cancelling one changes whose
 * reviews appear in queues, so the approval queue and dashboard refresh too.
 */
const delegationChangeTags = [
  "Delegations" as const,
  { type: "Expense" as const, id: "APPROVAL_QUEUE" },
  { type: "Dashboard" as const, id: "SUMMARY" },
];

export const delegationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDelegations: builder.query<DelegationList, void>({
      query: () => "/delegations",
      providesTags: ["Delegations"],
    }),

    getDelegationCandidates: builder.query<DelegationCandidate[], void>({
      query: () => "/delegations/candidates",
      providesTags: ["Delegations", "Users"],
    }),

    createDelegation: builder.mutation<DelegationView, CreateDelegationRequest>({
      query: (body) => ({ url: "/delegations", method: "POST", body }),
      invalidatesTags: delegationChangeTags,
    }),

    cancelDelegation: builder.mutation<DelegationView, string>({
      query: (id) => ({ url: `/delegations/${id}/cancel`, method: "POST" }),
      invalidatesTags: delegationChangeTags,
    }),
  }),
});

export const {
  useGetDelegationsQuery,
  useGetDelegationCandidatesQuery,
  useCreateDelegationMutation,
  useCancelDelegationMutation,
} = delegationApi;
