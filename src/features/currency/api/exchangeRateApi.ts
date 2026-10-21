import { baseApi } from "../../../services/api/baseApi";
import type { ForeignCurrencyCode } from "../../../types/common";
import type { ExchangeRateQuote } from "../types/currency";

export interface ExchangeRateArgs {
  currency: ForeignCurrencyCode;
  /** Calendar date, YYYY-MM-DD. */
  date: string;
}

export const exchangeRateApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Previews a conversion in expense forms; the API converts again when the expense is saved.
    getExchangeRate: builder.query<ExchangeRateQuote, ExchangeRateArgs>({
      query: ({ currency, date }) => `/exchange-rates?currency=${currency}&date=${date}`,
    }),
  }),
});

export const { useGetExchangeRateQuery } = exchangeRateApi;
