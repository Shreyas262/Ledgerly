import type { CollectionQuery } from "../../../types/api";
import { buildCollectionQuery } from "../../../services/api/queryParams";
import { baseApi } from "../../../services/api/baseApi";
import type { Document } from "../types/document";

export const documentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExpenseDocuments: builder.query<Document[], string | { expenseId: string; query?: CollectionQuery }>({
      query: (arg) => {
        const expenseId = typeof arg === "string" ? arg : arg.expenseId;
        const query = typeof arg === "string" ? undefined : arg.query;
        return `/expenses/${expenseId}/documents${buildCollectionQuery(query)}`;
      },
      providesTags: (_result, _error, expenseId) => [
        { type: "Document" as const, id: `EXPENSE-${expenseId}` },
      ],
    }),
    uploadDocument: builder.mutation<Document, { expenseId: string; file: File }>({
      query: ({ expenseId, file }) => {
        const body = new FormData();
        body.append("file", file);
        return { url: `/expenses/${expenseId}/documents`, method: "POST", body };
      },
      // Documents are linked through expense.documentIds.
      invalidatesTags: (_result, _error, { expenseId }) => [
        { type: "Document", id: `EXPENSE-${expenseId}` },
        { type: "Expense", id: expenseId },
      ],
    }),
    removeDocument: builder.mutation<Document, { id: string; expenseId: string }>({
      query: ({ id }) => ({ url: `/documents/${id}`, method: "DELETE" }),
      // Documents are linked through expense.documentIds.
      invalidatesTags: (_result, _error, { expenseId }) => [
        { type: "Document", id: `EXPENSE-${expenseId}` },
        { type: "Expense", id: expenseId },
      ],
    }),
    // Retrieves document content through the authorized API and returns a
    // temporary object URL for preview (§29.12). The binary itself is never
    // stored in the Redux cache; callers revoke the URL when done.
    fetchDocumentContent: builder.mutation<string, string>({
      query: (id) => ({
        url: `/documents/${id}/content`,
        responseHandler: async (response) =>
          response.ok
            ? URL.createObjectURL(await response.blob())
            : response.json(),
      }),
    }),
  }),
});

export const {
  useGetExpenseDocumentsQuery,
  useUploadDocumentMutation,
  useRemoveDocumentMutation,
  useFetchDocumentContentMutation,
} = documentsApi;
