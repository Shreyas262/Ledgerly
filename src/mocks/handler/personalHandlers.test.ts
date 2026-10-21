import { describe, expect, it } from "vitest";

import type { PersonalExpense } from "../../features/personal/types/personal";
import { listRecords } from "../services/mockDataService";
import { apiFetch, demoAccounts, failExchangeRateService, serveExchangeRates, setupApiServer, signIn } from "../../test/apiServer";
import { auditEventsFor, withFixedToday } from "../../test/fixtures";

setupApiServer();
withFixedToday("2026-10-19");

const dinner = { type: "DINING", paymentMethod: "CREDIT_CARD", description: "Dinner in Paris", expenseDate: "2026-10-16" };

const signInPersonal = () => signIn(demoAccounts.personal.email, demoAccounts.personal.password);

function saveExpense(cookie: string, body: Record<string, unknown>, id?: string): Promise<Response> {
  return apiFetch(
    id ? `/api/personal/expenses/${id}` : "/api/personal/expenses",
    { method: id ? "PUT" : "POST", body: JSON.stringify(body) },
    cookie,
  );
}

describe("personal expenses paid in other currencies", () => {
  it("keeps the expense in rupees with the amount as paid and the rate of its date", async () => {
    serveExchangeRates({ EUR: 106.86 });

    const response = await saveExpense(await signInPersonal(), { ...dinner, amount: 50, currency: "EUR" });

    expect(response.status).toBe(201);
    const expense = (await response.json()) as PersonalExpense;
    expect(expense).toMatchObject({
      amount: 5_343,
      currency: "INR",
      conversion: { originalAmount: 50, originalCurrency: "EUR", rate: 106.86, rateDate: "2026-10-16", source: "ECB" },
    });
    expect(await auditEventsFor(expense.id)).toEqual([
      expect.objectContaining({
        description: 'Added personal expense "Dinner in Paris" for EUR 50.00 (₹5,343).',
        metadata: expect.objectContaining({ paidAs: "EUR 50.00" }),
      }),
    ]);
  });

  it("treats a request that names no currency as rupees", async () => {
    const response = await saveExpense(await signInPersonal(), { ...dinner, amount: 860 });

    expect(response.status).toBe(201);
    const expense = (await response.json()) as PersonalExpense;
    expect(expense).toMatchObject({ amount: 860, currency: "INR" });
    expect(expense).not.toHaveProperty("conversion");
  });

  it("uses an approximate rate when current rates cannot be retrieved", async () => {
    failExchangeRateService();

    const response = await saveExpense(await signInPersonal(), { ...dinner, amount: 50, currency: "EUR" });

    expect(await response.json()).toMatchObject({ amount: 5_343.2, conversion: { rate: 106.864, source: "REFERENCE" } });
  });

  it("applies the amount limit to the converted amount", async () => {
    serveExchangeRates({ JPY: 0.6 });

    const response = await saveExpense(await signInPersonal(), { ...dinner, amount: 20_000_000, currency: "JPY" });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      details: { fieldErrors: { amount: "The amount cannot exceed ₹1,00,00,000 once converted to rupees." } },
    });
    expect(await listRecords("personalExpenses")).toEqual([]);
  });

  it("refuses a currency it cannot convert", async () => {
    const response = await saveExpense(await signInPersonal(), { ...dinner, amount: 50, currency: "AED" });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ details: { fieldErrors: { currency: "Choose a supported currency." } } });
    expect(await listRecords("personalExpenses")).toEqual([]);
  });

  it("converts again when edited and keeps no conversion for rupees", async () => {
    serveExchangeRates({ EUR: 106.86 });
    const cookie = await signInPersonal();
    const created = (await (await saveExpense(cookie, { ...dinner, amount: 50, currency: "EUR" })).json()) as PersonalExpense;

    const response = await saveExpense(cookie, { ...dinner, amount: 5_000, currency: "INR" }, created.id);

    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("conversion");
    const update = (await auditEventsFor(created.id)).find((event) => event.action === "EXPENSE_UPDATED");
    expect(update?.metadata?.changes).toContainEqual({ field: "paidAs", previousValue: "EUR 50.00 (₹5,343)", newValue: "₹5,000" });
  });

  it("finds expenses by the currency they were paid in", async () => {
    serveExchangeRates({ EUR: 106.86 });
    const cookie = await signInPersonal();
    await saveExpense(cookie, { ...dinner, amount: 50, currency: "EUR" });
    await saveExpense(cookie, { ...dinner, type: "GROCERIES", description: "Weekly groceries", amount: 860, currency: "INR" });

    const response = await apiFetch("/api/personal/expenses?search=eur", {}, cookie);

    const { data } = (await response.json()) as { data: PersonalExpense[] };
    expect(data.map((expense) => expense.description)).toEqual(["Dinner in Paris"]);
  });
});
