import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { extractReceiptText } from "../../documents/utils/extractReceiptText";
import type { Expense } from "../types/expense";
import { apiError } from "../../../mocks/services/apiError";
import { listRecords } from "../../../mocks/services/mockDataService";
import { server } from "../../../test/apiServer";
import { givenBudget, withFixedToday } from "../../../test/fixtures";
import { navigatedTo, renderPage, setupPageTests } from "../../../test/renderPage";
import { CreateExpensePage } from "./CreateExpensePage";

// Reading receipts runs PDF.js and Tesseract in browser workers; the tests supply the text they would read.
vi.mock("../../documents/utils/extractReceiptText", () => ({ extractReceiptText: vi.fn() }));

setupPageTests();
withFixedToday("2026-10-16");

function renderCreatePage() {
  return renderPage(<CreateExpensePage />, { path: "/expenses/new", as: "employee" });
}

async function fillForm(user: Awaited<ReturnType<typeof renderCreatePage>>["user"]) {
  await user.type(screen.getByRole("textbox", { name: "Title" }), "Team lunch");
  await user.type(screen.getByRole("textbox", { name: "Description" }), "Lunch with the project team");
  await user.type(screen.getByRole("spinbutton", { name: "Amount" }), "1200");
  fireEvent.change(screen.getByLabelText(/Expense date/), { target: { value: "2026-10-10" } });
}

describe("CreateExpensePage", () => {
  it("explains why expenses cannot be created and disables Create without an active budget", async () => {
    await renderCreatePage();

    expect(await screen.findByText(/there is no active budget for the current period/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Expense" })).toBeDisabled();
  });

  it("asks for confirmation and creates nothing when cancelled", async () => {
    await givenBudget();
    const { user } = await renderCreatePage();
    await screen.findByText(/must fall within the active budget period/);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create Expense" }));
    const dialog = await screen.findByRole("dialog", { name: "Create Expense" });
    expect(dialog).toHaveTextContent('Create "Team lunch" for ₹1,200 as a draft?');
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await listRecords("expenses")).toEqual([]);
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Team lunch");
  });

  it("creates a draft when confirmed and opens it", async () => {
    await givenBudget();
    const { user } = await renderCreatePage();
    await screen.findByText(/must fall within the active budget period/);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create Expense" }));
    await user.click(await screen.findByRole("button", { name: "Create" }));

    const location = await navigatedTo();
    const [expense] = await listRecords<Expense>("expenses");
    expect(location).toBe(`/expenses/${expense.id}`);
    expect(expense).toMatchObject({
      status: "draft",
      title: "Team lunch",
      amount: 1_200,
      expenseDate: "2026-10-10",
      employeeId: "user-1",
    });
  });

  it("shows the server's reason under the field and keeps what was typed", async () => {
    await givenBudget();
    // The date field's limits stop out-of-period dates in the browser, so the
    // server's field-level refusal is simulated for this request.
    server.use(
      http.post("/api/expenses", () =>
        apiError(422, "Please correct the highlighted fields.", "VALIDATION_ERROR", {
          fieldErrors: { title: "A title with this wording is not accepted." },
        }),
      ),
    );
    const { user } = await renderCreatePage();
    await screen.findByText(/must fall within the active budget period/);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Create Expense" }));
    await user.click(await screen.findByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const titleField = screen.getByRole("textbox", { name: "Title" });
    await waitFor(() => expect(titleField).toHaveAccessibleDescription("A title with this wording is not accepted."));
    expect(titleField).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Validation failed")).toBeInTheDocument();
    expect(titleField).toHaveValue("Team lunch");
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("Lunch with the project team");
    expect(screen.queryByTestId("current-location")).not.toBeInTheDocument();
  });
});

describe("CreateExpensePage receipts", () => {
  const receiptText = ["CAFE COFFEE DAY", "Date: 10/10/2026", "Grand Total 609.00"].join("\n");
  const pdf = (name = "bill.pdf") => new File(["%PDF"], name, { type: "application/pdf" });
  const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;

  beforeEach(async () => {
    await givenBudget();
    vi.mocked(extractReceiptText).mockReset();
  });

  async function renderReady() {
    const page = await renderCreatePage();
    await screen.findByText(/must fall within the active budget period/);
    return page;
  }

  it("fills the form from an attached receipt and attaches it to the new draft", async () => {
    vi.mocked(extractReceiptText).mockResolvedValue(receiptText);
    // jsdom's File cannot be parsed from a multipart body in Node, so the
    // upload is answered here; the stored result is covered by the upload API.
    const uploads: string[] = [];
    server.use(
      http.post("/api/expenses/:expenseId/documents", ({ params }) => {
        uploads.push(String(params.expenseId));
        return HttpResponse.json({ id: "document-1", expenseId: params.expenseId, fileName: "bill.pdf" }, { status: 201 });
      }),
    );
    const { user, router } = await renderReady();

    await user.upload(fileInput(), pdf());

    expect(await screen.findByText("Filled from bill.pdf: amount, expense date and title. Check them before saving.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Cafe Coffee Day");
    expect(screen.getByRole("spinbutton", { name: "Amount" })).toHaveValue(609);
    expect(screen.getByLabelText(/Expense date/)).toHaveValue("2026-10-10");

    await user.type(screen.getByRole("textbox", { name: "Description" }), "Coffee with a client");
    await user.click(screen.getByRole("button", { name: "Create Expense" }));
    expect(await screen.findByRole("dialog", { name: "Create Expense" })).toHaveTextContent(
      'Create "Cafe Coffee Day" for ₹609 with 1 receipt as a draft?',
    );
    await user.click(screen.getByRole("button", { name: "Create" }));

    const location = await navigatedTo();
    const [expense] = await listRecords<Expense>("expenses");
    expect(location).toBe(`/expenses/${expense.id}`);
    expect(expense).toMatchObject({ title: "Cafe Coffee Day", amount: 609, expenseDate: "2026-10-10" });
    expect(uploads).toEqual([expense.id]);
    expect(router.state.location.state).toBeFalsy();
  });

  it("keeps the values the user typed and fills the rest", async () => {
    vi.mocked(extractReceiptText).mockResolvedValue(receiptText);
    const { user } = await renderReady();
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Client meeting");

    await user.upload(fileInput(), pdf());

    expect(await screen.findByText("Filled from bill.pdf: amount and expense date. Check them before saving.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Client meeting");
    expect(screen.getByRole("spinbutton", { name: "Amount" })).toHaveValue(609);
  });

  it("names the details a receipt did not reveal", async () => {
    vi.mocked(extractReceiptText).mockResolvedValue("Grand Total 609.00");
    const { user } = await renderReady();

    await user.upload(fileInput(), pdf());

    expect(await screen.findByText(/The expense date and title could not be read\./)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("");
  });

  it("keeps a receipt that cannot be read attached and leaves the form usable", async () => {
    vi.mocked(extractReceiptText).mockRejectedValue(new Error("OCR failed"));
    const { user } = await renderReady();

    await user.upload(fileInput(), pdf());

    expect(await screen.findByText(/bill\.pdf could not be read, but remains attached/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bill.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Create Expense" })).toBeEnabled();
  });

  it("refuses files that cannot be attached without reading them", async () => {
    await renderReady();

    fireEvent.change(fileInput(), { target: { files: [new File(["notes"], "notes.txt", { type: "text/plain" })] } });
    expect(await screen.findByText("notes.txt: only JPG, PNG and PDF files are supported.")).toBeInTheDocument();

    const tooLarge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "scan.png", { type: "image/png" });
    fireEvent.change(fileInput(), { target: { files: [tooLarge] } });
    expect(await screen.findByText("scan.png: files can be at most 5 MB.")).toBeInTheDocument();

    const six = Array.from({ length: 6 }, (_, index) => pdf(`bill-${index}.pdf`));
    fireEvent.change(fileInput(), { target: { files: six } });
    expect(await screen.findByText("Attach at most 5 files.")).toBeInTheDocument();

    expect(extractReceiptText).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /\.pdf$|\.png$|\.txt$/ })).not.toBeInTheDocument();
  });

  it("keeps the draft and reports a receipt that could not be uploaded", async () => {
    vi.mocked(extractReceiptText).mockResolvedValue(receiptText);
    server.use(http.post("/api/expenses/:id/documents", () => apiError(500, "Storage is unavailable.")));
    const { user, router } = await renderReady();

    await user.upload(fileInput(), pdf());
    await screen.findByText(/Filled from bill\.pdf/);
    await user.type(screen.getByRole("textbox", { name: "Description" }), "Coffee with a client");
    await user.click(screen.getByRole("button", { name: "Create Expense" }));
    await user.click(await screen.findByRole("button", { name: "Create" }));

    await navigatedTo();
    expect(await listRecords<Expense>("expenses")).toEqual([expect.objectContaining({ status: "draft", documentIds: [] })]);
    expect(router.state.location.state).toEqual({
      receiptError: "The expense was created, but bill.pdf could not be attached. You can add it below.",
    });
  });
});
