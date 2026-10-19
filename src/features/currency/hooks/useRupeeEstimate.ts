import { skipToken } from "@reduxjs/toolkit/query/react";

import type { CurrencyCode } from "../../../types/common";
import { isForeignCurrency, roundMoney } from "../../../utils/currency";
import { useGetExchangeRateQuery } from "../api/exchangeRateApi";

const isCalendarDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * The rupee value of an amount being entered, using the exchange rate for the
 * expense date. Rupee amounts are their own value; the API converts other
 * currencies again when the expense is saved.
 */
export function useRupeeEstimate(amount: string, currency: CurrencyCode, expenseDate: string) {
  const foreign = isForeignCurrency(currency);
  const hasDate = isCalendarDate(expenseDate);
  // currentData: never the rate of a previously chosen currency or date.
  const { currentData: quote, isFetching, isError } = useGetExchangeRateQuery(
    isForeignCurrency(currency) && hasDate ? { currency, date: expenseDate } : skipToken,
  );

  const value = Number(amount);
  const hasAmount = amount.trim() !== "" && Number.isFinite(value) && value > 0;
  let rupees: number | undefined;
  if (hasAmount) rupees = foreign ? (quote ? roundMoney(value * quote.rate) : undefined) : value;

  return { foreign, hasDate, quote, rupees, isFetching, isError };
}
