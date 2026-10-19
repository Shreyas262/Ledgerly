import type { BaseCurrencyCode, CurrencyCode, ForeignCurrencyCode } from "../types/common";

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

/** The currency amounts are stored and reported in. */
export const BASE_CURRENCY: BaseCurrencyCode = "INR";

/** The currencies an amount can be paid in, the rupee first. */
export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  INR: "Indian rupee",
  AUD: "Australian dollar",
  BRL: "Brazilian real",
  CAD: "Canadian dollar",
  CHF: "Swiss franc",
  CNY: "Chinese yuan",
  CZK: "Czech koruna",
  DKK: "Danish krone",
  EUR: "Euro",
  GBP: "British pound",
  HKD: "Hong Kong dollar",
  HUF: "Hungarian forint",
  IDR: "Indonesian rupiah",
  ILS: "Israeli new shekel",
  ISK: "Icelandic króna",
  JPY: "Japanese yen",
  KRW: "South Korean won",
  MXN: "Mexican peso",
  MYR: "Malaysian ringgit",
  NOK: "Norwegian krone",
  NZD: "New Zealand dollar",
  PHP: "Philippine peso",
  PLN: "Polish złoty",
  RON: "Romanian leu",
  SEK: "Swedish krona",
  SGD: "Singapore dollar",
  THB: "Thai baht",
  TRY: "Turkish lira",
  USD: "US dollar",
  ZAR: "South African rand",
};

export const CURRENCY_CODES = Object.keys(CURRENCY_NAMES) as CurrencyCode[];

export const isCurrencyCode = (value: unknown): value is CurrencyCode =>
  typeof value === "string" && Object.hasOwn(CURRENCY_NAMES, value);

export const isForeignCurrency = (value: unknown): value is ForeignCurrencyCode =>
  isCurrencyCode(value) && value !== BASE_CURRENCY;

// Currencies without minor units.
const WHOLE_UNIT_CURRENCIES = new Set<CurrencyCode>(["ISK", "JPY", "KRW"]);

/** Decimal places a currency's amounts are written with. */
export const currencyDecimals = (currency: CurrencyCode): number =>
  WHOLE_UNIT_CURRENCIES.has(currency) ? 0 : 2;

/** Rounds to a currency's smallest unit, such as paise for rupees. */
export function roundMoney(value: number, currency: CurrencyCode = BASE_CURRENCY): number {
  const factor = 10 ** currencyDecimals(currency);
  return Math.round(value * factor) / factor;
}

/**
 * Formats an amount in its currency: rupees as ₹1,23,456 (with paise only when
 * there are any, e.g. ₹5,697.60), other currencies by code, e.g. USD 60.00.
 */
export function formatMoney(value: number, currency: CurrencyCode = BASE_CURRENCY): string {
  if (currency === BASE_CURRENCY) {
    return formatCurrency(value, Number.isInteger(value) ? undefined : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const decimals = currencyDecimals(currency);
  return `${currency} ${formatAmount(value, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** Rupees per unit of a currency, e.g. ₹94.96, or ₹0.6010 for rates below one rupee. */
export function formatRate(rate: number): string {
  const digits = rate < 1 ? 4 : 2;
  return formatCurrency(rate, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
