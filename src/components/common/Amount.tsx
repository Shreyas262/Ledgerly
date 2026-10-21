import { Typography } from "@mui/material";

import type { CurrencyCode } from "../../types/common";
import { formatMoney } from "../../utils/currency";

interface AmountProps {
  value: number;
  /** Defaults to rupees, shown with the rupee symbol; other currencies by code. */
  currency?: CurrencyCode;
}

/** Inline monetary value with tabular numerals; inherits size and colour. */
export function Amount({ value, currency }: AmountProps) {
  return (
    <Typography variant="numeric">
      {formatMoney(value, currency)}
    </Typography>
  );
}
