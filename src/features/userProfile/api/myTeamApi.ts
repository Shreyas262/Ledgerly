import { baseApi } from "../../../services/api/baseApi";
import type { MyTeam } from "../types/myTeam";

export const myTeamApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** The caller's team (Finance: authorized departments) and expense reviewers (§9.6). */
    getMyTeam: builder.query<MyTeam, void>({
      query: () => "/me/team",
      providesTags: ["Users", "Teams"],
    }),
  }),
});

export const { useGetMyTeamQuery } = myTeamApi;
