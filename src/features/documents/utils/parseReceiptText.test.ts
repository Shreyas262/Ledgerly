import { describe, expect, it } from "vitest";

import { parseReceiptText } from "./parseReceiptText";

const receipt = (...lines: string[]) => lines.join("\n");

describe("parseReceiptText", () => {
  it("reads a typical restaurant receipt", () => {
    const text = receipt(
      "CAFE COFFEE DAY",
      "12, MG Road, Bengaluru 560001",
      "GSTIN: 29ABCDE1234F1Z5",
      "Bill No: 4521   Date: 27/09/2026 13:21",
      "Cappuccino        2   360.00",
      "Sandwich          1   220.00",
      "Sub Total             580.00",
      "CGST 2.5%              14.50",
      "SGST 2.5%              14.50",
      "Grand Total       ₹ 609.00",
      "Thank you, visit again",
    );

    expect(parseReceiptText(text)).toEqual({ amount: 609, currency: "INR", date: "2026-09-27", merchant: "Cafe Coffee Day" });
  });

  it("flags a whole total ending in 00 as possibly missing its decimal point", () => {
    expect(parseReceiptText(receipt("Masala Dosa", "Total 85000"))).toMatchObject({ amount: 85_000, amountUncertain: true });
    expect(parseReceiptText(receipt("Masala Dosa", "Total 850.00")).amountUncertain).toBeUndefined();
    expect(parseReceiptText(receipt("Masala Dosa", "Total 850")).amountUncertain).toBeUndefined();
    expect(parseReceiptText(receipt("Masala Dosa", "Total 1234")).amountUncertain).toBeUndefined();
  });

  it("prefers a labelled total over a larger amount elsewhere", () => {
    const text = receipt("Hotel Residency", "Room deposit 5,000.00", "Total 2,450.50", "Paid by card");

    expect(parseReceiptText(text).amount).toBe(2_450.5);
  });

  it("prefers the grand total over other totals", () => {
    const text = receipt("Shop", "Total 1,000.00", "Total Tax 180.00", "Grand Total 1,180.00");

    expect(parseReceiptText(text).amount).toBe(1_180);
  });

  it("ignores lines that only look like totals", () => {
    const text = receipt("Mart", "Total Items 12", "Total Savings 40.00", "Sub Total 900.00", "Net Amount Rs. 860.00");

    expect(parseReceiptText(text).amount).toBe(860);
  });

  it("reads Indian digit grouping and currency markers", () => {
    expect(parseReceiptText("Amount Payable INR 1,23,456.78").amount).toBe(123_456.78);
    expect(parseReceiptText("Total Rs.2,500").amount).toBe(2_500);
    expect(parseReceiptText("TOTAL ₹ 99").amount).toBe(99);
  });

  it("takes the amount from the next line when the label stands alone", () => {
    expect(parseReceiptText(receipt("Store", "Grand Total", "1,499.00")).amount).toBe(1_499);
  });

  it("falls back to the largest money amount, ignoring phone and identifier numbers", () => {
    const text = receipt("Pharmacy", "Phone: 9876543210", "Invoice No 778812", "Paracetamol 45.50", "Bandage 120.00");

    expect(parseReceiptText(text).amount).toBe(120);
  });

  it("does not take dates or times for amounts", () => {
    expect(parseReceiptText(receipt("Kiosk", "27.09.2026 10:45")).amount).toBeUndefined();
  });

  it("reads the date formats used on receipts", () => {
    expect(parseReceiptText("Date: 05/03/2026").date).toBe("2026-03-05");
    expect(parseReceiptText("Dt 05-03-26").date).toBe("2026-03-05");
    expect(parseReceiptText("Date 2026-03-05").date).toBe("2026-03-05");
    expect(parseReceiptText("5 Mar 2026").date).toBe("2026-03-05");
    expect(parseReceiptText("05-March-2026").date).toBe("2026-03-05");
    expect(parseReceiptText("Mar 5, 2026").date).toBe("2026-03-05");
  });

  it("prefers the labelled date over a due date or other dates", () => {
    const text = receipt("Telecom Ltd", "Due Date: 20/10/2026", "Period 01/09/2026", "Bill Date: 05/10/2026");

    expect(parseReceiptText(text).date).toBe("2026-10-05");
  });

  it("does not take a due date for the expense date when no date is labelled", () => {
    const text = receipt("Telecom Ltd", "Payment due 20/10/2026", "Period 01/09/2026 to 30/09/2026");

    expect(parseReceiptText(text).date).toBe("2026-09-01");
  });

  it("reads the currency printed with the total", () => {
    expect(parseReceiptText(receipt("City Diner", "Total $45.00")).currency).toBe("USD");
    expect(parseReceiptText("Total € 12.50").currency).toBe("EUR");
    expect(parseReceiptText("Grand Total £8.20").currency).toBe("GBP");
    expect(parseReceiptText("TOTAL S$ 15.40").currency).toBe("SGD");
    expect(parseReceiptText("Amount Payable USD 120.00").currency).toBe("USD");
    expect(parseReceiptText("Total 3,500 JPY")).toMatchObject({ amount: 3_500, currency: "JPY" });
    expect(parseReceiptText("Net Amount Rs. 860.00").currency).toBe("INR");
  });

  it("reads the currency the receipt names most when the total does not name one", () => {
    const text = receipt("Corner Shop", "Coffee $3.50", "Muffin $2.75", "TOTAL 6.25");

    expect(parseReceiptText(text)).toMatchObject({ amount: 6.25, currency: "USD" });
  });

  it("names no currency for receipts without one, or for words that look like codes", () => {
    expect(parseReceiptText("Grand Total 609.00").currency).toBeUndefined();
    expect(parseReceiptText(receipt("TRY OUR NEW MENU", "TRY 2 FOR 1", "Total 450.00")).currency).toBeUndefined();
  });

  it("counts whole amounts next to a currency symbol as money", () => {
    expect(parseReceiptText(receipt("Market stall", "Apples $4", "Bread $3")).amount).toBe(4);
  });

  it("rejects impossible dates", () => {
    expect(parseReceiptText("Date: 31/02/2026").date).toBeUndefined();
    expect(parseReceiptText("Date: 12/13/2026").date).toBeUndefined();
  });

  it("skips headings, addresses and contact lines when finding the merchant", () => {
    const text = receipt("TAX INVOICE", "Ph: 080-2345678", "Sharma Electricals", "Shop No 4, Station Road");

    expect(parseReceiptText(text).merchant).toBe("Sharma Electricals");
  });

  it("returns nothing when the text has no usable details", () => {
    expect(parseReceiptText("")).toEqual({});
    expect(parseReceiptText("### ~~ ||| 12")).toEqual({});
  });
});
