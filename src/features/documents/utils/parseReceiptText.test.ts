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

    expect(parseReceiptText(text)).toEqual({ amount: 609, date: "2026-09-27", merchant: "Cafe Coffee Day" });
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
