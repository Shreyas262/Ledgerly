import type { ForeignCurrencyCode, ISODateString } from "../../../types/common";

/**
 * Where an exchange rate came from: the European Central Bank's reference
 * rates, or the bundled approximate rates used when those cannot be retrieved.
 */
export type ExchangeRateSource = "ECB" | "REFERENCE";

/** Rupees per unit of a currency for a date. */
export interface ExchangeRateQuote {
  currency: ForeignCurrencyCode;
  rate: number;
  /** The date the rate was published for: the previous business day for weekends and holidays. */
  rateDate: ISODateString;
  source: ExchangeRateSource;
}

/** How an amount paid in another currency was converted to rupees. */
export interface CurrencyConversion {
  originalAmount: number;
  originalCurrency: ForeignCurrencyCode;
  /** Rupees per unit of the original currency. */
  rate: number;
  rateDate: ISODateString;
  source: ExchangeRateSource;
}
