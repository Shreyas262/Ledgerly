import { describe, expect, it } from "vitest";

import { applyReceiptDetails, describeReceiptFill, type ReceiptFieldMap } from "./receiptFill";

interface Form {
  title: string;
  amount: string;
  currency: string;
  expenseDate: string;
}

const FIELDS: ReceiptFieldMap<Form> = {
  amount: { field: "amount", label: "amount" },
  currency: { field: "currency", label: "currency" },
  date: { field: "expenseDate", label: "expense date" },
  merchant: { field: "title", label: "title" },
};

const EMPTY: Form = { title: "", amount: "", currency: "INR", expenseDate: "" };

describe("applyReceiptDetails", () => {
  it("fills every field the receipt reveals", () => {
    const fill = applyReceiptDetails(EMPTY, { amount: 609, date: "2026-09-27", merchant: "Cafe" }, FIELDS, new Set());

    expect(fill).toEqual({
      form: { title: "Cafe", amount: "609", currency: "INR", expenseDate: "2026-09-27" },
      filled: ["amount", "expense date", "title"],
      missing: [],
      checkAmount: false,
    });
  });

  it("asks to check an amount that may have been misread, unless the user typed it", () => {
    const receipt = { amount: 85_000, amountUncertain: true };

    const fill = applyReceiptDetails(EMPTY, receipt, FIELDS, new Set());
    expect(fill.checkAmount).toBe(true);
    expect(describeReceiptFill("blurry.jpg", fill)).toBe(
      "Filled from blurry.jpg: amount. Check them before saving. The expense date and title could not be read. The amount was read without a decimal point and may be too large, so check it against the receipt.",
    );

    expect(applyReceiptDetails(EMPTY, receipt, FIELDS, new Set<keyof Form>(["amount"])).checkAmount).toBe(false);
  });

  it("keeps what the user typed and does not report it as missing", () => {
    const form = { ...EMPTY, title: "Team lunch" };

    const fill = applyReceiptDetails(form, { merchant: "Cafe" }, FIELDS, new Set<keyof Form>(["title"]));

    expect(fill.form.title).toBe("Team lunch");
    expect(fill.filled).toEqual([]);
    expect(fill.missing).toEqual(["amount", "expense date"]);
  });

  it("replaces values a receipt filled earlier", () => {
    const form = { ...EMPTY, amount: "100" };

    expect(applyReceiptDetails(form, { amount: 250 }, FIELDS, new Set()).form.amount).toBe("250");
  });

  it("fills the currency the receipt names", () => {
    const fill = applyReceiptDetails(EMPTY, { amount: 45, currency: "USD" }, FIELDS, new Set());

    expect(fill.form).toMatchObject({ amount: "45", currency: "USD" });
    expect(fill.filled).toEqual(["amount", "currency"]);
  });

  it("keeps the chosen currency when the receipt names none, without reporting it as missing", () => {
    const form = { ...EMPTY, currency: "EUR" };

    const fill = applyReceiptDetails(form, { amount: 45, date: "2026-09-27", merchant: "Cafe" }, FIELDS, new Set());

    expect(fill.form.currency).toBe("EUR");
    expect(fill.missing).toEqual([]);
  });

  it("keeps a currency the user chose over the one on the receipt", () => {
    const form = { ...EMPTY, currency: "GBP" };

    const fill = applyReceiptDetails(form, { currency: "USD" }, FIELDS, new Set<keyof Form>(["currency"]));

    expect(fill.form.currency).toBe("GBP");
    expect(fill.filled).toEqual([]);
  });
});

describe("describeReceiptFill", () => {
  it("names what was filled and what could not be read", () => {
    expect(describeReceiptFill("bill.pdf", { filled: ["amount", "expense date"], missing: ["title"] })).toBe(
      "Filled from bill.pdf: amount and expense date. Check them before saving. The title could not be read.",
    );
  });

  it("says when nothing could be read", () => {
    expect(describeReceiptFill("photo.jpg", { filled: [], missing: ["amount", "expense date", "title"] })).toBe(
      "No details could be read from photo.jpg. Fill in the fields yourself.",
    );
  });

  it("says when every field had already been entered", () => {
    expect(describeReceiptFill("photo.jpg", { filled: [], missing: [] })).toBe(
      "photo.jpg has been attached. The details you entered have been kept.",
    );
  });
});
