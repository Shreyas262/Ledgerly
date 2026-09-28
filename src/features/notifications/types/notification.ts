import type { NotificationCategory } from "../../settings/types/settings";

export interface AppNotification {
  /** Stable id: the audit event id, or a fixed id for summaries. */
  id: string;
  category: NotificationCategory;
  severity: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  /** Where the notification leads. */
  link: string;
  timestamp: string;
}
