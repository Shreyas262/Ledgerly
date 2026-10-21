import type { ForeignCurrencyCode } from "../../../types/common";
import { formatMoney, formatRate } from "../../../utils/currency";
import { formatDate } from "../../../utils/format";
import type { CurrencyConversion, ExchangeRateSource } from "../types/currency";

interface RateDetails {
  rate: number;
  rateDate: string;
  source: ExchangeRateSource;
}

/** "1 USD = ₹94.96, the European Central Bank rate for 16 Oct 2026". */
export function describeRate(currency: ForeignCurrencyCode, { rate, rateDate, source }: RateDetails): string {
  const value = `1 ${currency} = ${formatRate(rate)}`;
  return source === "ECB"
    ? `${value}, the European Central Bank rate for ${formatDate(rateDate)}`
    : `${value}, an approximate rate from ${formatDate(rateDate)} used because current rates could not be retrieved`;
}

/** "USD 60.00": the amount as it was paid. */
export const describePaidAmount = (conversion: CurrencyConversion): string =>
  formatMoney(conversion.originalAmount, conversion.originalCurrency);
