export type ThemePreference = "system" | "light" | "dark";

/** Where the user lands after signing in. */
export type StartPage =
  | "/dashboard"
  | "/expenses"
  | "/approvals"
  | "/personal/dashboard"
  | "/personal/expenses";

/** Notification categories the user can switch on or off. */
export type NotificationCategory =
  | "EXPENSE_UPDATES"
  | "REIMBURSEMENTS"
  | "REVIEW_QUEUE"
  | "POLICY_ALERTS"
  | "BUDGET_ALERTS";

export interface UserSettings {
  theme: ThemePreference;
  startPage: StartPage;
  notifications: Record<NotificationCategory, boolean>;
  /** Notifications at or before this time are read. */
  notificationsReadAt?: string;
}
