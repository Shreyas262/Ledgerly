/** Turns a code such as `USER_CREATED` or `under_review` into "User created". */
export const humanize = (value: string | null | undefined): string => {
  // Stored records are not guaranteed to match their types; render a dash instead of crashing.
  if (!value) return "—";
  const words = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Formats an ISO timestamp in local time as e.g. "26 Sep 2026, 6:01 pm". */
export const formatDateTime = (value: string | null | undefined): string => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  const hours = date.getHours();
  const time = `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")} ${hours < 12 ? "am" : "pm"}`;
  return `${formatDate(value)}, ${time}`;
};

/** A date's local calendar day as YYYY-MM-DD, the format expense dates are entered in. */
export const toDateOnly = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const MONTHS =["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Formats a date as e.g. "27 Sep 2026". Calendar dates (YYYY-MM-DD) are shown
 * as written; timestamps are shown in the viewer's local time zone.
 */
export const formatDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return `${day} ${MONTHS[month - 1]} ${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

/** Up to two initials from a person's name: "Asha Kumar" → "AK". */
export const initialsOf = (name: string | null | undefined): string =>
  (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
