export type ThemePreference = "light" | "dark" | "system";

export interface UserSettings {
  theme: ThemePreference;
  currency: "INR";
  expenseNotifications: boolean;
}