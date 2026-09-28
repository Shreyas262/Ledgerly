import { formatCurrency } from "../../../utils/currency";

const compactFormatter = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

/** Short axis labels, e.g. ₹1.2L. */
export const formatCompactCurrency = (value: number | null) => `₹${compactFormatter.format(value ?? 0)}`;

export const formatChartCurrency = (value: number | null) => formatCurrency(value ?? 0);
