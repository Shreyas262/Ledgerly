export type EntityId = string;
export type ISODateString = string;

/**
 * Currencies an amount can be paid in: the Indian rupee and the currencies
 * the European Central Bank publishes reference rates for.
 */
export type CurrencyCode =
  | "INR"
  | "AUD"
  | "BRL"
  | "CAD"
  | "CHF"
  | "CNY"
  | "CZK"
  | "DKK"
  | "EUR"
  | "GBP"
  | "HKD"
  | "HUF"
  | "IDR"
  | "ILS"
  | "ISK"
  | "JPY"
  | "KRW"
  | "MXN"
  | "MYR"
  | "NOK"
  | "NZD"
  | "PHP"
  | "PLN"
  | "RON"
  | "SEK"
  | "SGD"
  | "THB"
  | "TRY"
  | "USD"
  | "ZAR";

/** Amounts are stored, checked and reported in rupees. */
export type BaseCurrencyCode = "INR";

/** A currency that is converted to rupees. */
export type ForeignCurrencyCode = Exclude<CurrencyCode, BaseCurrencyCode>;

export interface ResourceTimestamps {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
