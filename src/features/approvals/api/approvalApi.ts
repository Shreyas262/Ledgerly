import type { CollectionQuery } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import { baseApi } from "../../../services/api/baseApi";
import type { Expense } from "../../expenses/types/expense";

export const approvalsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getApprovalQueue: builder.query<Expense[], CollectionQuery | void>({
      query: (query) => `/approvals${buildCollectionQuery(query ?? undefined)}`,
      providesTags: [{ type: "Expense", id: "APPROVAL_QUEUE" }],
    }),
  }),
});

export const { useGetApprovalQueueQuery } = approvalsApi;
