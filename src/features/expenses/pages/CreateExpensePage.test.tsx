import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { extractReceiptText } from "../../documents/utils/extractReceiptText";
import type { Expense } from "../types/expense";
import { apiError } from "../../../mocks/services/apiError";
import { listRecords } from "../../../mocks/services/mockDataService";
import { server, serveExchangeRates } from "../../../test/apiServer";
import { givenBudget, givenPolicy, withFixedToday } from "../../../test/fixtures";
import { navigatedTo, renderPage, selectOption, setupPageTests } from "../../../test/renderPage";
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

  it("fills the currency from a receipt in another currency", async () => {
    vi.mocked(extractReceiptText).mockResolvedValue(["CITY DINER", "Date: 10/10/2026", "Total $45.00"].join("\n"));
    serveExchangeRates({ USD: 94.96 });
    const { user } = await renderReady();

    await user.upload(fileInput(), pdf());

    expect(await screen.findByText("Filled from bill.pdf: amount, currency, expense date and title. Check them before saving.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Currency/ })).toHaveTextContent("USD");
    expect(await screen.findByText(/^About ₹4,273.20 at 1 USD = ₹94.96/)).toBeInTheDocument();
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

describe("CreateExpensePage currencies", () => {
  async function renderReady() {
    const page = await renderCreatePage();
    await screen.findByText(/must fall within the active budget period/);
    return page;
  }

  async function enterDollars(user: Awaited<ReturnType<typeof renderCreatePage>>["user"]) {
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Team dinner");
    await user.type(screen.getByRole("textbox", { name: "Description" }), "Dinner with the New York team");
    await user.type(screen.getByRole("spinbutton", { name: "Amount" }), "60");
    await selectOption(user, /^Currency/, /^USD /);
    // A Saturday: the rate is Friday's.
    fireEvent.change(screen.getByLabelText(/Expense date/), { target: { value: "2026-10-10" } });
  }

  it("previews the rupee amount, confirms both amounts and keeps the expense in rupees", async () => {
    await givenBudget();
    serveExchangeRates({ USD: 94.96 });
    const { user } = await renderReady();

    await enterDollars(user);
    expect(await screen.findByText(
      "About ₹5,697.60 at 1 USD = ₹94.96, the European Central Bank rate for 9 Oct 2026. The rate is fixed when the expense is saved.",
    )).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create Expense" }));
    expect(await screen.findByRole("dialog", { name: "Create Expense" })).toHaveTextContent(
      'Create "Team dinner" for USD 60.00 (about ₹5,697.60) as a draft?',
    );
    await user.click(screen.getByRole("button", { name: "Create" }));

    await navigatedTo();
    const [expense] = await listRecords<Expense>("expenses");
    expect(expense).toMatchObject({
      amount: 5_697.6,
      currency: "INR",
      conversion: { originalAmount: 60, originalCurrency: "USD", rate: 94.96, rateDate: "2026-10-09", source: "ECB" },
    });
  });

  it("checks the policy against the rupee amount", async () => {
    await givenBudget();
    await givenPolicy({ rules: { maximumAmount: { amount: 5_000, enforcement: "BLOCK" } } });
    serveExchangeRates({ USD: 94.96 });
    const { user } = await renderReady();

    await enterDollars(user);

    expect(await screen.findByText(/Above the ₹5,000 maximum per expense\./)).toBeInTheDocument();
  });

  it("shows the rupee amount prominently", async () => {
    await givenBudget();
    serveExchangeRates({ USD: 94.96 });
    const { user } = await renderReady();

    await enterDollars(user);

    expect(await screen.findByText("In rupees: ₹5,697.60")).toBeInTheDocument();
  });

  it("names the policy each inherited rule comes from", async () => {
    await givenBudget();
    await givenPolicy({ name: "Standard", rules: { maximumAmount: { amount: 5_000, enforcement: "BLOCK" } } });
    await givenPolicy({ name: "Meals policy", expenseType: "MEALS", rules: { duplicateCheck: { enforcement: "WARN" } } });
    const { user } = await renderReady();

    await selectOption(user, /^Expense type/, /^Meals$/);

    expect(await screen.findByText("Policy: Meals policy")).toBeInTheDocument();
    expect(screen.getByText("Above ₹5,000 per expense (from Standard)")).toBeInTheDocument();
  });

  it("asks for the expense date before converting", async () => {
    await givenBudget();
    const { user } = await renderReady();

    await selectOption(user, /^Currency/, /^EUR /);

    expect(screen.getByText("Choose the expense date to see the amount in rupees.")).toBeInTheDocument();
  });
});
