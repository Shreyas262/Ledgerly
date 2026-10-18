import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { extractReceiptText } from "../../documents/utils/extractReceiptText";
import type { PersonalExpense } from "../types/personal";
import { listRecords, saveRecord } from "../../../mocks/services/mockDataService";
import { server } from "../../../test/apiServer";
import { withFixedToday } from "../../../test/fixtures";
import { navigatedTo, renderPage, setupPageTests } from "../../../test/renderPage";
import { PersonalExpenseFormPage } from "./PersonalExpenseFormPage";

// Reading receipts runs PDF.js and Tesseract in browser workers; the tests supply the text they would read.
vi.mock("../../documents/utils/extractReceiptText", () => ({ extractReceiptText: vi.fn() }));

setupPageTests();
withFixedToday("2026-10-16");

const receiptText = ["FRESH MART", "Date: 12/10/2026", "Total Items 4", "Net Amount Rs. 860.00"].join("\n");
const photo = () => new File(["jpg"], "groceries.jpg", { type: "image/jpeg" });
const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;

function renderAddExpense() {
  return renderPage(<PersonalExpenseFormPage mode="create" />, { path: "/personal/expenses/new", as: "personal" });
}

describe("PersonalExpenseFormPage receipts", () => {
  beforeEach(() => {
    vi.mocked(extractReceiptText).mockReset();
  });

  it("fills the form from an attached receipt and adds the receipt to the new expense", async () => {
    vi.mocked(extractReceiptText).mockResolvedValue(receiptText);
    // jsdom's File cannot be parsed from a multipart body in Node, so the upload is answered here.
    const uploads: string[] = [];
    server.use(
      http.post("/api/personal/expenses/:id/documents", ({ params }) => {
        uploads.push(String(params.id));
        return HttpResponse.json({ id: "document-1", expenseId: params.id, fileName: "groceries.jpg" }, { status: 201 });
      }),
    );
    const { user } = await renderAddExpense();

    await user.upload(fileInput(), photo());

    expect(await screen.findByText("Filled from groceries.jpg: amount, date and description. Check them before saving.")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Amount" })).toHaveValue(860);
    expect(screen.getByLabelText(/^Date/)).toHaveValue("2026-10-12");
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("Fresh Mart");

    await user.click(screen.getByRole("button", { name: "Add Expense" }));
    expect(await screen.findByRole("dialog", { name: "Add Expense" })).toHaveTextContent('Add "Fresh Mart" for ₹860 with 1 receipt?');
    await user.click(screen.getAllByRole("button", { name: "Add Expense" }).at(-1)!);

    const location = await navigatedTo();
    const [expense] = await listRecords<PersonalExpense>("personalExpenses");
    expect(location).toBe(`/personal/expenses/${expense.id}`);
    expect(expense).toMatchObject({ amount: 860, expenseDate: "2026-10-12", description: "Fresh Mart" });
    expect(uploads).toEqual([expense.id]);
  });

  it("keeps a description the user typed", async () => {
    vi.mocked(extractReceiptText).mockResolvedValue(receiptText);
    const { user } = await renderAddExpense();
    await user.type(screen.getByRole("textbox", { name: "Description" }), "Weekly groceries");

    await user.upload(fileInput(), photo());

    expect(await screen.findByText("Filled from groceries.jpg: amount and date. Check them before saving.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("Weekly groceries");
  });

  it("keeps a receipt that cannot be read attached", async () => {
    vi.mocked(extractReceiptText).mockRejectedValue(new Error("OCR failed"));
    const { user } = await renderAddExpense();

    await user.upload(fileInput(), photo());

    expect(await screen.findByText(/groceries\.jpg could not be read, but remains attached/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "groceries.jpg" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Amount" })).toHaveValue(null);
  });

  it("does not offer receipts when editing; they are managed on the expense's page", async () => {
    const expense = await saveRecord<PersonalExpense>("personalExpenses", {
      id: "personal-expense-1",
      ownerId: "user-personal-1",
      type: "GROCERIES",
      amount: 500,
      currency: "INR",
      expenseDate: "2026-10-10",
      description: "Weekly groceries",
      paymentMethod: "UPI",
      documentIds: [],
      createdAt: "2026-10-10T10:00:00.000Z",
      updatedAt: "2026-10-10T10:00:00.000Z",
    });

    await renderPage(<PersonalExpenseFormPage mode="edit" />, {
      path: "/personal/expenses/:id/edit",
      route: `/personal/expenses/${expense.id}/edit`,
      as: "personal",
    });

    expect(await screen.findByText("Receipts and documents are managed on the expense's page.")).toBeInTheDocument();
    expect(screen.queryByText("Attach Receipts")).not.toBeInTheDocument();
  });
});
