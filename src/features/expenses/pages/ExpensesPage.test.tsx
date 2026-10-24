import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiError } from "../../../mocks/services/apiError";
import { downloadPdf } from "../../../services/pdf/downloadPdf";
import { server } from "../../../test/apiServer";
import { givenExpense, givenPolicy, readExpense } from "../../../test/fixtures";
import { pdfTables, pdfText } from "../../../test/pdfText";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { ExpensesPage } from "./ExpensesPage";

// Creating the file runs pdfmake in the browser; the tests check what would be downloaded.
vi.mock("../../../services/pdf/downloadPdf", () => ({ downloadPdf: vi.fn() }));

setupPageTests();

const draft = (title: string, amount = 1_000) => givenExpense({ title, amount, status: "draft", documentIds: ["document-1"] });

function renderExpenses(as: "employee" | "manager" = "employee") {
  return renderPage(<ExpensesPage />, { path: "/expenses", as });
}

describe("ExpensesPage submitting several drafts", () => {
  it("offers selection only on the user's drafts that can be submitted", async () => {
    await draft("Taxi");
    await givenExpense({ title: "No receipt yet", status: "draft", documentIds: [] });
    await givenExpense({ title: "Already submitted", status: "submitted", documentIds: ["document-1"] });

    await renderExpenses();

    expect(await screen.findByRole("checkbox", { name: "Select Taxi" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Select No receipt yet" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Select Already submitted" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Selected" })).toBeDisabled();
  });

  it("submits every selected draft after confirmation and reports the result", async () => {
    const taxi = await draft("Taxi", 400);
    const hotel = await draft("Hotel", 2_000);
    const { user } = await renderExpenses();

    await user.click(await screen.findByRole("checkbox", { name: "Select All Drafts" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit Selected" }));
    const dialog = await screen.findByRole("dialog", { name: "Submit Expenses" });
    expect(dialog).toHaveTextContent("Submit 2 expenses totalling ₹2,400 for approval?");
    await user.click(within(dialog).getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("2 expenses submitted for approval.")).toBeInTheDocument();
    expect(await readExpense(taxi.id)).toMatchObject({ status: "submitted" });
    expect(await readExpense(hotel.id)).toMatchObject({ status: "submitted" });
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Select Taxi" })).not.toBeInTheDocument());
  });

  it("submits nothing when the confirmation is cancelled", async () => {
    const taxi = await draft("Taxi");
    const { user } = await renderExpenses();

    await user.click(await screen.findByRole("checkbox", { name: "Select Taxi" }));
    await user.click(screen.getByRole("button", { name: "Submit Selected" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await readExpense(taxi.id)).toMatchObject({ status: "draft" });
    expect(screen.getByRole("checkbox", { name: "Select Taxi" })).toBeChecked();
  });

  it("keeps drafts that could not be submitted selected and explains why", async () => {
    await givenPolicy({ rules: { maximumAmount: { amount: 500, enforcement: "BLOCK" } } });
    const taxi = await draft("Taxi", 400);
    const hotel = await draft("Hotel", 2_000);
    const { user } = await renderExpenses();

    await user.click(await screen.findByRole("checkbox", { name: "Select All Drafts" }));
    await user.click(screen.getByRole("button", { name: "Submit Selected" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Submit" }));

    const summary = await screen.findByText("1 expense submitted for approval.");
    expect(summary.closest('[role="alert"]')).toHaveTextContent(
      '1 expense could not be submitted and remains selected:"Hotel": Amount exceeds the maximum of ₹500 per expense.',
    );
    expect(await readExpense(taxi.id)).toMatchObject({ status: "submitted" });
    expect(await readExpense(hotel.id)).toMatchObject({ status: "draft" });
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Select Hotel" })).toBeChecked());
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("clears the selection when the filters change", async () => {
    await draft("Taxi");
    const { user } = await renderExpenses();

    await user.click(await screen.findByRole("checkbox", { name: "Select Taxi" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search expenses" }), { target: { value: "Taxi" } });

    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Select Taxi" })).not.toBeChecked());
    expect(screen.getByText("0 selected")).toBeInTheDocument();
  });

  it("offers no selection in the team view", async () => {
    await givenExpense({ title: "Manager's taxi", owner: "manager", status: "draft", documentIds: ["document-1"] });
    await givenExpense({ title: "Team member's hotel", owner: "employee", status: "submitted", documentIds: ["document-1"] });
    const { user } = await renderExpenses("manager");

    expect(await screen.findByRole("checkbox", { name: "Select Manager's taxi" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Team Expenses" }));

    expect(await screen.findByText("Team member's hotel")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit Selected" })).not.toBeInTheDocument();
  });
});

describe("ExpensesPage PDF report", () => {
  beforeEach(() => {
    vi.mocked(downloadPdf).mockReset();
  });

  async function exportReport(user: Awaited<ReturnType<typeof renderExpenses>>["user"]): Promise<[TDocumentDefinitions, string]> {
    await user.click(screen.getByRole("button", { name: "Export PDF" }));
    await waitFor(() => expect(downloadPdf).toHaveBeenCalledTimes(1));
    return vi.mocked(downloadPdf).mock.calls[0];
  }

  it("includes every expense in the view, not only the page on screen", async () => {
    for (let index = 1; index <= 105; index += 1) await givenExpense({ title: `Trip ${index}`, status: "submitted" });
    const { user } = await renderExpenses();
    expect(await screen.findAllByText(/^Trip \d+$/)).toHaveLength(25);

    const [report, fileName] = await exportReport(user);

    const [expenses] = pdfTables(report);
    // The header and total rows, and every expense.
    expect(expenses).toHaveLength(107);
    expect(pdfText(report)).toContain("My Expenses");
    expect(fileName).toMatch(/^ledgerly-my-expenses-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it("lists only what the team view shows, with each employee", async () => {
    await givenExpense({ title: "Team member's hotel", owner: "employee", status: "submitted" });
    await givenExpense({ title: "Private draft", owner: "employee", status: "draft" });
    const { user } = await renderExpenses("manager");
    await user.click(await screen.findByRole("tab", { name: "Team Expenses" }));
    await screen.findByText("Team member's hotel");

    const [report] = await exportReport(user);

    const text = pdfText(report);
    expect(text).toContain("Team Expenses");
    expect(text).toContain("Team member's hotel");
    expect(text).not.toContain("Private draft");
    expect(pdfTables(report)[0][0]).toContain("Employee");
  });

  it("cannot export a view without expenses", async () => {
    await renderExpenses();

    await waitFor(() => expect(screen.getByRole("button", { name: "Export PDF" })).toBeDisabled());
  });

  it("explains when the PDF could not be created", async () => {
    vi.mocked(downloadPdf).mockRejectedValue(new Error("Font missing"));
    await givenExpense({ title: "Taxi", status: "submitted" });
    const { user } = await renderExpenses();
    await screen.findByText("Taxi");

    await user.click(screen.getByRole("button", { name: "Export PDF" }));

    expect(await screen.findByText("The PDF could not be created. Try again.")).toBeInTheDocument();
  });

  it("shows why the expenses could not be loaded and creates nothing", async () => {
    await givenExpense({ title: "Taxi", status: "submitted" });
    // Only the report's requests, which fetch 100 expenses at a time, fail.
    server.use(
      http.get("/api/expenses", ({ request }) =>
        new URL(request.url).searchParams.get("pageSize") === "100" ? apiError(403, "You may no longer view these expenses.") : undefined,
      ),
    );
    const { user } = await renderExpenses();
    await screen.findByText("Taxi");

    await user.click(screen.getByRole("button", { name: "Export PDF" }));

    expect(await screen.findByText("You may no longer view these expenses.")).toBeInTheDocument();
    expect(downloadPdf).not.toHaveBeenCalled();
  });
});

describe("ExpensesPage date filter", () => {
  it("keeps the list and filters on screen while an inverted range is corrected", async () => {
    await givenExpense({ title: "Taxi", expenseDate: "2026-10-12" });
    await givenExpense({ title: "Dinner", expenseDate: "2026-09-02" });
    await renderExpenses();

    expect(await screen.findByText("Taxi")).toBeInTheDocument();
    const from = screen.getByLabelText("From");
    const to = screen.getByLabelText("To");

    fireEvent.change(from, { target: { value: "2026-10-10" } });
    fireEvent.change(to, { target: { value: "2026-10-01" } });

    expect(await screen.findByText("The end date must be on or after the start date.")).toBeInTheDocument();
    expect(screen.getByText("Taxi")).toBeInTheDocument();

    fireEvent.change(to, { target: { value: "2026-10-31" } });

    await waitFor(() => expect(screen.queryByText("Dinner")).not.toBeInTheDocument());
    expect(screen.getByText("Taxi")).toBeInTheDocument();
  });
});

describe("ExpensesPage receipt reminder", () => {
  it("explains why a draft without a receipt cannot be submitted", async () => {
    await givenExpense({ title: "No receipt yet", status: "draft", documentIds: [] });
    const { user } = await renderExpenses();

    const button = await screen.findByRole("button", { name: "Receipt Required" });
    expect(button).toBeDisabled();
    // A disabled button receives no pointer events; its wrapper shows the reason.
    await user.hover(button.parentElement!);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Attach a receipt before submitting.");
  });
});

describe("ExpensesPage opened from a link", () => {
  it("starts on the status the link asks for", async () => {
    await givenExpense({ title: "Unfinished taxi", status: "draft", documentIds: [] });
    await givenExpense({ title: "Submitted hotel", status: "submitted" });

    await renderPage(<ExpensesPage />, { path: "/expenses", as: "employee", state: { status: "draft" } });

    expect(await screen.findByText("Unfinished taxi")).toBeInTheDocument();
    expect(screen.queryByText("Submitted hotel")).not.toBeInTheDocument();
  });
});
