import { Typography } from "@mui/material";

import { formatAmount, formatCurrency } from "../../utils/currency";

interface AmountProps {
  value: number;
  /** Currency code shown before the value; defaults to the rupee symbol. */
  currency?: string;
}

/** Inline monetary value with tabular numerals; inherits size and colour. */
export function Amount({ value, currency }: AmountProps) {
  return (
    <Typography variant="amount">
      {currency ? `${currency} ${formatAmount(value)}` : formatCurrency(value)}
    </Typography>
  );
}
