import type { ForeignCurrencyCode } from "../../types/common";

/** The date of the European Central Bank reference rates below. */
export const REFERENCE_RATE_DATE = "2026-10-16";

/**
 * Rupees per unit of each currency, from the European Central Bank reference
 * rates of REFERENCE_RATE_DATE. Used only when current rates cannot be
 * retrieved; expenses converted with them are marked as approximate.
 */
export const REFERENCE_RATES: Record<ForeignCurrencyCode, number> = {
  AUD: 66.0837,
  BRL: 18.6835,
  CAD: 67.0624,
  CHF: 115.255,
  CNY: 14.2031,
  CZK: 4.39354,
  DKK: 14.2966,
  EUR: 106.864,
  GBP: 126.639,
  HKD: 12.1002,
  HUF: 0.294326,
  IDR: 0.00526676,
  ILS: 30.6886,
  ISK: 0.784611,
  JPY: 0.600967,
  KRW: 0.0712897,
  MXN: 5.16573,
  MYR: 23.2672,
  NOK: 10.0587,
  NZD: 53.787,
  PHP: 1.50814,
  PLN: 24.454,
  RON: 20.0458,
  SEK: 9.58852,
  SGD: 74.2369,
  THB: 2.84198,
  TRY: 1.91743,
  USD: 94.9649,
  ZAR: 5.77862,
};
