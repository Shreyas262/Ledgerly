import { describe, expect, it } from "vitest";

import { apiFetch, demoAccounts, failExchangeRateService, serveExchangeRates, setupApiServer, signIn } from "../../test/apiServer";
import { withFixedToday } from "../../test/fixtures";

setupApiServer();
// A Monday, so the Saturday before takes the previous Friday's rate.
withFixedToday("2026-10-19");

function getRate(query: string, cookie?: string): Promise<Response> {
  return apiFetch(`/api/exchange-rates?${query}`, {}, cookie);
}

describe("GET /api/exchange-rates", () => {
  it("requires signing in", async () => {
    expect((await getRate("currency=USD&date=2026-10-16")).status).toBe(401);
  });

  it("returns the European Central Bank rate for the date", async () => {
    serveExchangeRates({ USD: 94.96 });
    const cookie = await signIn(demoAccounts.employee.email, demoAccounts.employee.password);

    const response = await getRate("currency=USD&date=2026-10-16", cookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ currency: "USD", rate: 94.96, rateDate: "2026-10-16", source: "ECB" });
  });

  it("takes the previous business day's rate for a weekend and the latest rate for a later date", async () => {
    serveExchangeRates({ EUR: 106.86 });
    const cookie = await signIn(demoAccounts.employee.email, demoAccounts.employee.password);

    expect(await (await getRate("currency=EUR&date=2026-10-17", cookie)).json()).toMatchObject({ rateDate: "2026-10-16" });
    expect(await (await getRate("currency=EUR&date=2026-10-30", cookie)).json()).toMatchObject({ rateDate: "2026-10-19", source: "ECB" });
  });

  it("is available to personal accounts", async () => {
    serveExchangeRates({ GBP: 126.64 });
    const cookie = await signIn(demoAccounts.personal.email, demoAccounts.personal.password);

    expect(await (await getRate("currency=GBP&date=2026-10-16", cookie)).json()).toMatchObject({ currency: "GBP", rate: 126.64 });
  });

  it("uses an approximate rate when current rates cannot be retrieved, and asks again next time", async () => {
    failExchangeRateService();
    const cookie = await signIn(demoAccounts.employee.email, demoAccounts.employee.password);

    expect(await (await getRate("currency=USD&date=2026-10-16", cookie)).json()).toEqual({
      currency: "USD",
      rate: 94.9649,
      rateDate: "2026-10-16",
      source: "REFERENCE",
    });

    serveExchangeRates({ USD: 94.96 });
    expect(await (await getRate("currency=USD&date=2026-10-16", cookie)).json()).toMatchObject({ rate: 94.96, source: "ECB" });
  });

  it.each([
    ["the rupee", "currency=INR&date=2026-10-16", "currency"],
    ["an unsupported currency", "currency=AED&date=2026-10-16", "currency"],
    ["an invalid date", "currency=USD&date=2026-02-30", "date"],
  ])("refuses %s", async (_case, query, field) => {
    const cookie = await signIn(demoAccounts.employee.email, demoAccounts.employee.password);

    const response = await getRate(query, cookie);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ details: { fieldErrors: { [field]: expect.any(String) } } });
  });
});
