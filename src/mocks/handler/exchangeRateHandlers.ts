import { http, HttpResponse } from "msw";

import { isForeignCurrency } from "../../utils/currency";
import { apiError } from "../services/apiError";
import { resolveAuthenticatedPrincipal } from "../services/authorizationService";
import { getExchangeRate } from "../services/exchangeRateService";
import { isCalendarDate } from "../services/personalService";

export const exchangeRateHandlers = [
  // Any signed-in account: expense forms preview conversions with it. The
  // expense endpoints convert again when an expense is saved.
  http.get("/api/exchange-rates", async ({ request }) => {
    const principal = await resolveAuthenticatedPrincipal(request);
    if (!principal) return apiError(401, "Please sign in to continue.");

    const params = new URL(request.url).searchParams;
    const currency = params.get("currency");
    const date = params.get("date");
    const fieldErrors: Record<string, string> = {};
    if (!isForeignCurrency(currency)) fieldErrors.currency = "Choose a supported currency other than the Indian rupee.";
    if (!isCalendarDate(date)) fieldErrors.date = "A valid date is required.";
    if (!isForeignCurrency(currency) || !isCalendarDate(date)) {
      return apiError(422, "Please correct the highlighted fields.", "VALIDATION_ERROR", { fieldErrors });
    }

    return HttpResponse.json(await getExchangeRate(currency, date));
  }),
];
