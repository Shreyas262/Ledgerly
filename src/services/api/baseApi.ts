import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
  }),
  tagTypes: [
    "User",
    "Expense",
    "Approval",
    "Policy",
    "Budget",
    "Analytics",
    "Audit",
    "Roles",
    "Users",
  ],
  endpoints: () => ({}),
});