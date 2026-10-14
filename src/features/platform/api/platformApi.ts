import { baseApi } from "../../../services/api/baseApi";
import type { CreateOrganizationRequest, PlatformOrganization } from "../types/platform";

export const platformApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPlatformOrganizations: builder.query<PlatformOrganization[], void>({
      query: () => "/platform/organizations",
      providesTags: ["PlatformOrganizations"],
    }),
    createOrganization: builder.mutation<PlatformOrganization, CreateOrganizationRequest>({
      query: (body) => ({ url: "/platform/organizations", method: "POST", body }),
      invalidatesTags: ["PlatformOrganizations"],
    }),
  }),
});

export const { useGetPlatformOrganizationsQuery, useCreateOrganizationMutation } = platformApi;
