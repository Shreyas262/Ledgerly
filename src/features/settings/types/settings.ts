export type ThemePreference = "system" | "light" | "dark";

export interface UserSettings {
  theme: ThemePreference;
  currency: "INR";
  expenseNotifications: boolean;
}
