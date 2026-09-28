import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import type { ApiError } from "../../types/api";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api",
});

const toApiError = (error: FetchBaseQueryError): ApiError => {
  const status = typeof error.status === "number" ? error.status : 500;
  const payload =
    error.data && typeof error.data === "object"
      ? (error.data as Partial<ApiError>)
      : undefined;

  return {
    status,
    code:
      typeof payload?.code === "string"
        ? payload.code
        : status === 400
          ? "BAD_REQUEST"
          : status === 401
            ? "UNAUTHENTICATED"
            : status === 403
              ? "FORBIDDEN"
              : status === 404
                ? "NOT_FOUND"
                : status === 409
                  ? "CONFLICT"
                  : status === 422
                    ? "VALIDATION_ERROR"
                    : "INTERNAL_ERROR",
    message:
      typeof payload?.message === "string"
        ? payload.message
        : "The request could not be completed.",
    details:
      payload?.details && typeof payload.details === "object"
        ? payload.details
        : undefined,
  };
};

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, ApiError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if ("error" in result && result.error) {
    return { error: toApiError(result.error) };
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery,
  keepUnusedDataFor: 300,
  tagTypes: [
    "User",
    "Expense",
    "Approval",
    "Policies",
    "Budgets",
    "Analytics",
    "Dashboard",
    "Audit",
    "Activity",
    "Roles",
    "Users",
    "Organization",
    "Departments",
    "Teams",
    "Document",
    "PersonalExpense",
    "PersonalBudget",
    "PersonalDocument",
    "PersonalInsights",
  ],
  endpoints: () => ({}),
});
