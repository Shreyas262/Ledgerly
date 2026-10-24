import { toDateOnly } from "../../../utils/format";

export type DashboardPreset = "all_time" | "this_month" | "last_3_months" | "this_year" | "custom";

export const DASHBOARD_PRESETS: Array<{ value: DashboardPreset; label: string }> = [
  { value: "this_month", label: "This month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "this_year", label: "This year" },
  { value: "all_time", label: "All time" },
  { value: "custom", label: "Custom" },
];

/** The dashboard opens on everything the user has recorded. */
export const DEFAULT_DASHBOARD_PRESET: DashboardPreset = "all_time";

export interface DashboardDateRange {
  preset: DashboardPreset;
  /** "" for an open start. */
  startDate: string;
  /** "" for an open end. */
  endDate: string;
}

export const DEFAULT_DASHBOARD_RANGE: DashboardDateRange = { preset: DEFAULT_DASHBOARD_PRESET, startDate: "", endDate: "" };

/** The dates a preset stands for, up to today. */
export function dashboardPresetRange(preset: Exclude<DashboardPreset, "custom">, now = new Date()): DashboardDateRange {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = toDateOnly(now);
  switch (preset) {
    case "all_time":
      return { preset, startDate: "", endDate: "" };
    case "this_month":
      return { preset, startDate: toDateOnly(new Date(year, month, 1)), endDate: today };
    case "last_3_months":
      return { preset, startDate: toDateOnly(new Date(year, month, now.getDate() - 89)), endDate: today };
    case "this_year":
      return { preset, startDate: toDateOnly(new Date(year, 0, 1)), endDate: today };
  }
}
