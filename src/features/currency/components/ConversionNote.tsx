import { Typography } from "@mui/material";

import type { CurrencyConversion } from "../types/currency";
import { describePaidAmount, describeRate } from "../utils/rateText";

interface ConversionNoteProps {
  /** Absent for expenses paid in rupees, which show nothing. */
  conversion?: CurrencyConversion;
  /** Also names the exchange rate and where it came from. */
  showRate?: boolean;
}

/** "Paid as USD 60.00", shown with the rupee amount of an expense paid in another currency. */
export function ConversionNote({ conversion, showRate = false }: ConversionNoteProps) {
  if (!conversion) return null;

  return (
    <Typography variant={showRate ? "body2" : "caption"} color="text.secondary" component="span" sx={{ display: "block" }}>
      {showRate
        ? `Paid as ${describePaidAmount(conversion)} at ${describeRate(conversion.originalCurrency, conversion)}.`
        : `Paid as ${describePaidAmount(conversion)}`}
    </Typography>
  );
}
