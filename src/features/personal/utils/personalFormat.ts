import { useTheme } from "@mui/material";

import { PERSONAL_EXPENSE_TYPES, type PersonalExpenseType } from "../types/personal";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-09" → "September 2026" (or "Sep 2026" when short). */
export function formatMonth(month: string, short = false): string {
  const [year, index] = month.split("-").map(Number);
  const name = MONTH_NAMES[index - 1];
  if (!name) return month;
  return `${short ? name.slice(0, 3) : name} ${year}`;
}

/** Current calendar month in local time, YYYY-MM. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Today's calendar date in local time, YYYY-MM-DD. */
export function todayDate(): string {
  return `${currentMonth()}-${String(new Date().getDate()).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(year, index - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Colours for personal expense types, from the theme's categorical palette. */
export function usePersonalTypeColor() {
  const { palette } = useTheme();
  const { categorical, other } = palette.chart;
  return (type: PersonalExpenseType): string => {
    if (type === "OTHER") return other;
    const index = PERSONAL_EXPENSE_TYPES.indexOf(type);
    return categorical[index % categorical.length];
  };
}
