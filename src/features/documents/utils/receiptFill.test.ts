import { describe, expect, it } from "vitest";

import { applyReceiptDetails, describeReceiptFill, type ReceiptFieldMap } from "./receiptFill";

interface Form {
  title: string;
  amount: string;
  expenseDate: string;
}

const FIELDS: ReceiptFieldMap<Form> = {
  amount: { field: "amount", label: "amount" },
  date: { field: "expenseDate", label: "expense date" },
  merchant: { field: "title", label: "title" },
};

const EMPTY: Form = { title: "", amount: "", expenseDate: "" };

describe("applyReceiptDetails", () => {
  it("fills every field the receipt reveals", () => {
    const fill = applyReceiptDetails(EMPTY, { amount: 609, date: "2026-09-27", merchant: "Cafe" }, FIELDS, new Set());

    expect(fill).toEqual({
      form: { title: "Cafe", amount: "609", expenseDate: "2026-09-27" },
      filled: ["amount", "expense date", "title"],
      missing: [],
    });
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
