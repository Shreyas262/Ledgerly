import type { CollectionQuery } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import { baseApi } from "../../../services/api/baseApi";
import type { Expense } from "../../expenses/types/expense";

export const reimbursementsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getReimbursementQueue: builder.query<Expense[], CollectionQuery | void>({
      query: (query) => `/reimbursements${buildCollectionQuery(query ?? undefined)}`,
      providesTags: [{ type: "Expense", id: "REIMBURSEMENT_QUEUE" }],
    }),
  }),
});

export const { useGetReimbursementQueueQuery } = reimbursementsApi;
