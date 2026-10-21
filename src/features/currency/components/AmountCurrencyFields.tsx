import { MenuItem, Stack, TextField, Typography } from "@mui/material";

import type { CurrencyCode } from "../../../types/common";
import { CURRENCY_CODES, CURRENCY_NAMES, currencyDecimals, formatMoney } from "../../../utils/currency";
import { useRupeeEstimate } from "../hooks/useRupeeEstimate";
import { describeRate } from "../utils/rateText";

interface AmountCurrencyFieldsProps {
  amount: string;
  currency: CurrencyCode;
  /** The expense date, whose exchange rate converts other currencies. */
  expenseDate: string;
  onAmountChange: (amount: string) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
  amountError?: string;
  currencyError?: string;
  autoFocus?: boolean;
}

/**
 * The amount as paid and its currency. For other currencies the rupee value is
 * previewed with the rate for the expense date.
 */
export function AmountCurrencyFields({
  amount,
  currency,
  expenseDate,
  onAmountChange,
  onCurrencyChange,
  amountError,
  currencyError,
  autoFocus,
}: AmountCurrencyFieldsProps) {
  const estimate = useRupeeEstimate(amount, currency, expenseDate);

  let preview: string | null = null;
  if (estimate.foreign) {
    if (!estimate.hasDate) preview = "Choose the expense date to see the amount in rupees.";
    else if (estimate.quote) {
      const rate = describeRate(estimate.quote.currency, estimate.quote);
      preview = estimate.rupees === undefined
        ? `${rate}.`
        : `About ${formatMoney(estimate.rupees)} at ${rate}. The rate is fixed when the expense is saved.`;
    } else if (estimate.isFetching) preview = "Getting the exchange rate…";
    else if (estimate.isError) preview = "The exchange rate could not be retrieved. The amount is converted to rupees when the expense is saved.";
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <TextField
          label="Amount"
          name="amount"
          type="number"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          error={Boolean(amountError)}
          helperText={amountError}
          required
          fullWidth
          autoFocus={autoFocus}
          slotProps={{
            htmlInput: { min: 0, step: currencyDecimals(currency) ? "0.01" : "1", inputMode: "decimal" },
          }}
        />
        <TextField
          select
          label="Currency"
          value={currency}
          onChange={(event) => onCurrencyChange(event.target.value as CurrencyCode)}
          error={Boolean(currencyError)}
          helperText={currencyError}
          required
          sx={{ width: 120, flexShrink: 0 }}
          slotProps={{ select: { renderValue: (value) => String(value) } }}
        >
          {CURRENCY_CODES.map((code) => (
            <MenuItem key={code} value={code}>
              {code} · {CURRENCY_NAMES[code]}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {preview && (
        <Typography variant="body2" color="text.secondary" role="status">
          {preview}
        </Typography>
      )}
    </Stack>
  );
}
