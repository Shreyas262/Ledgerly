/** Turns a code such as `USER_CREATED` or `under_review` into "User created". */
export const humanize = (value: string | null | undefined): string => {
  // Stored records are not guaranteed to match their types; render a dash instead of crashing.
  if (!value) return "—";
  const words = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Formats an ISO timestamp as e.g. "26 Sep 2026, 6:01 pm". */
export const formatDateTime = (value: string | null | undefined): string => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? dateTimeFormatter.format(date) : "—";
};
