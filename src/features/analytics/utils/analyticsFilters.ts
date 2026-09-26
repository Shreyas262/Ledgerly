import type { AnalyticsInterval, AnalyticsQuery } from "../types/analytics";
import { EXPENSE_TYPES, type ExpenseType } from "../../expenses/types/expense";

export type DatePreset =
  | "this_month"
  | "last_3_months"
  | "this_quarter"
  | "last_12_months"
  | "custom";

export const DATE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "this_month", label: "This month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "this_quarter", label: "This quarter" },
  { value: "last_12_months", label: "Last 12 months" },
  { value: "custom", label: "Custom" },
];

export const DEFAULT_PRESET: DatePreset = "last_12_months";

/** Maximum range accepted by the API (§26.3). */
export const MAX_RANGE_DAYS = 366;

const pad = (value: number) => String(value).padStart(2, "0");
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function presetRange(preset: Exclude<DatePreset, "custom">, now = new Date()): { from: string; to: string } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const to = localDate(now);
  switch (preset) {
    case "this_month":
      return { from: localDate(new Date(year, month, 1)), to };
    case "last_3_months":
      return { from: localDate(new Date(year, month, now.getDate() - 89)), to };
    case "this_quarter":
      return { from: localDate(new Date(year, month - (month % 3), 1)), to };
    case "last_12_months":
      return { from: localDate(new Date(year, month - 11, 1)), to };
  }
}

export interface AnalyticsFilterState {
  preset: DatePreset;
  from: string;
  to: string;
  type: ExpenseType | "";
  departmentId: string;
  teamId: string;
}

const isPreset = (value: string | null): value is DatePreset =>
  DATE_PRESETS.some((preset) => preset.value === value);

/** Reads filters from the URL so views can be bookmarked and shared. */
export function readFilters(params: URLSearchParams): AnalyticsFilterState {
  const rawPreset = params.get("range");
  const preset: DatePreset = isPreset(rawPreset) ? rawPreset : DEFAULT_PRESET;
  const range = preset === "custom"
    ? { from: params.get("from") ?? "", to: params.get("to") ?? "" }
    : presetRange(preset);
  const type = params.get("type") ?? "";
  return {
    preset,
    ...range,
    type: (EXPENSE_TYPES as string[]).includes(type) ? (type as ExpenseType) : "",
    departmentId: params.get("department") ?? "",
    teamId: params.get("team") ?? "",
  };
}

export function writeFilters(filters: AnalyticsFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.preset !== DEFAULT_PRESET) params.set("range", filters.preset);
  if (filters.preset === "custom") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
  if (filters.type) params.set("type", filters.type);
  if (filters.departmentId) params.set("department", filters.departmentId);
  if (filters.teamId) params.set("team", filters.teamId);
  return params;
}

export function countActiveFilters(filters: AnalyticsFilterState): number {
  return [filters.preset !== DEFAULT_PRESET, filters.type, filters.departmentId, filters.teamId].filter(Boolean).length;
}

export function rangeError(filters: AnalyticsFilterState): string | null {
  if (filters.preset !== "custom") return null;
  if (!filters.from || !filters.to) return "Choose both a start and an end date.";
  if (filters.from > filters.to) return "The start date must be before or equal to the end date.";
  const days = (new Date(filters.to).getTime() - new Date(filters.from).getTime()) / 86_400_000 + 1;
  if (days > MAX_RANGE_DAYS) return `Date ranges cannot exceed ${MAX_RANGE_DAYS} days.`;
  return null;
}

export function toQuery(filters: AnalyticsFilterState): AnalyticsQuery {
  return {
    from: filters.from || undefined,
    to: filters.to || undefined,
    type: filters.type || undefined,
    departmentId: filters.departmentId || undefined,
    teamId: filters.teamId || undefined,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Axis label for a trend bucket. */
export function formatPeriod(period: string, interval: AnalyticsInterval): string {
  const month = MONTHS[Number(period.slice(5, 7)) - 1];
  if (interval === "MONTH") return `${month} ${period.slice(2, 4)}`;
  return `${Number(period.slice(8, 10))} ${month}`;
}

export function formatDate(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}
