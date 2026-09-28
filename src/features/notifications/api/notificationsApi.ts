import { baseApi } from "../../../services/api/baseApi";
import type { AppNotification } from "../types/notification";

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** Notifications for the signed-in user (§24.4). */
    getNotifications: builder.query<AppNotification[], void>({
      query: () => "/notifications",
      transformResponse: (response: { data: AppNotification[] }) => response.data,
    }),
  }),
});

export const { useGetNotificationsQuery } = notificationsApi;
