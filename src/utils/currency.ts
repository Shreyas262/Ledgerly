/** Formats a number with Indian digit grouping, e.g. 1,23,456. */
export const formatAmount = (
  value: number,
  options?: Intl.NumberFormatOptions,
): string => value.toLocaleString("en-IN", options);

/** Formats a rupee value, e.g. ₹1,23,456. */
export const formatCurrency = (
  value: number,
  options?: Intl.NumberFormatOptions,
): string => `₹${formatAmount(value, options)}`;
