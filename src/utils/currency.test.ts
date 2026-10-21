import { describe, expect, it } from "vitest";

import { formatMoney, formatRate, isCurrencyCode, isForeignCurrency, roundMoney } from "./currency";

describe("formatMoney", () => {
  it("shows rupees with the rupee symbol and Indian grouping, with paise only when there are any", () => {
    expect(formatMoney(123_456)).toBe("₹1,23,456");
    expect(formatMoney(5_697.6)).toBe("₹5,697.60");
    expect(formatMoney(1_200, "INR")).toBe("₹1,200");
  });

  it("shows other currencies by code with their decimals", () => {
    expect(formatMoney(60, "USD")).toBe("USD 60.00");
    expect(formatMoney(1_234.5, "EUR")).toBe("EUR 1,234.50");
    expect(formatMoney(1_500, "JPY")).toBe("JPY 1,500");
  });
});

describe("formatRate", () => {
  it("shows two decimals, or four below one rupee", () => {
    expect(formatRate(94.9649)).toBe("₹94.96");
    expect(formatRate(0.600967)).toBe("₹0.6010");
  });
});

describe("roundMoney", () => {
  it("rounds to the currency's smallest unit", () => {
    expect(roundMoney(5_697.894)).toBe(5_697.89);
    expect(roundMoney(1_500.7, "JPY")).toBe(1_501);
  });
});

describe("currency codes", () => {
  it("accepts the supported currencies only", () => {
    expect(isCurrencyCode("USD")).toBe(true);
    expect(isCurrencyCode("AED")).toBe(false);
    expect(isCurrencyCode("toString")).toBe(false);
    expect(isForeignCurrency("EUR")).toBe(true);
    expect(isForeignCurrency("INR")).toBe(false);
  });
});
