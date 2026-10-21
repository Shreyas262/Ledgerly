import type { CurrencyConversion, ExchangeRateQuote } from "../../features/currency/types/currency";
import { describePaidAmount, describeRate } from "../../features/currency/utils/rateText";
import type { CurrencyCode, ForeignCurrencyCode } from "../../types/common";
import { isForeignCurrency, roundMoney } from "../../utils/currency";
import { toDateOnly } from "../../utils/format";
import { REFERENCE_RATES, REFERENCE_RATE_DATE } from "../data/referenceRates";

/** Frankfurter publishes the European Central Bank reference rates; free and without a key. */
export const EXCHANGE_RATE_SERVICE_URL = "https://api.frankfurter.dev/v1";

const TIMEOUT_MS = 5_000;

// Rates of past dates never change, so answers are kept for the session.
const quotes = new Map<string, ExchangeRateQuote>();

/** Forgets the rates retrieved so far. */
export function clearExchangeRateCache(): void {
  quotes.clear();
}

/**
 * Rupees per unit of a currency for a date. Weekends and holidays take the
 * previous business day's rate; dates after the latest published rate take
 * that one. When the rates cannot be retrieved, the bundled reference rates
 * are used and marked as approximate; they are not kept, so the next request
 * asks again.
 */
export async function getExchangeRate(currency: ForeignCurrencyCode, date: string): Promise<ExchangeRateQuote> {
  const key = `${currency}:${date}`;
  const known = quotes.get(key);
  if (known) return known;

  const day = date > toDateOnly() ? "latest" : date;
  try {
    const response = await fetch(`${EXCHANGE_RATE_SERVICE_URL}/${day}?base=${currency}&symbols=INR`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`The exchange rate service answered ${response.status}.`);
    const body = (await response.json()) as { date?: unknown; rates?: { INR?: unknown } };
    const rate = body.rates?.INR;
    if (typeof rate !== "number" || !(rate > 0) || typeof body.date !== "string") {
      throw new Error("The exchange rate service returned no rupee rate.");
    }
    const quote: ExchangeRateQuote = { currency, rate, rateDate: body.date, source: "ECB" };
    quotes.set(key, quote);
    return quote;
  } catch {
    return { currency, rate: REFERENCE_RATES[currency], rateDate: REFERENCE_RATE_DATE, source: "REFERENCE" };
  }
}

/**
 * The rupee value of an amount paid in a currency on a date. Rupee amounts are
 * kept as they are; other currencies are converted with the rate for the date,
 * to the paisa, and the conversion is returned so it can be kept with the expense.
 */
export async function toRupees(
  amount: number,
  currency: CurrencyCode,
  date: string,
): Promise<{ amount: number; conversion?: CurrencyConversion }> {
  if (!isForeignCurrency(currency)) return { amount };

  const originalAmount = roundMoney(amount, currency);
  const { rate, rateDate, source } = await getExchangeRate(currency, date);
  return {
    amount: roundMoney(originalAmount * rate),
    conversion: { originalAmount, originalCurrency: currency, rate, rateDate, source },
  };
}

/** How a conversion is recorded in the audit log: the amount as paid and the rate, as read. */
export function conversionAuditDetails(conversion: CurrencyConversion | undefined): { paidAs?: string; exchangeRate?: string } {
  return conversion
    ? { paidAs: describePaidAmount(conversion), exchangeRate: describeRate(conversion.originalCurrency, conversion) }
    : {};
}
