import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { auditEventsFor, givenExpense, givenPolicy, readExpense } from "../../../test/fixtures";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { ExpenseDetailsPage } from "./ExpenseDetailsPage";

setupPageTests();

function renderOwnExpense(id: string) {
  return renderPage(<ExpenseDetailsPage mode="default" />, { path: "/expenses/:id", route: `/expenses/${id}`, as: "employee" });
}

async function confirmSubmit(user: Awaited<ReturnType<typeof renderOwnExpense>>["user"]) {
  await user.click(await screen.findByRole("button", { name: "Submit Expense" }));
  expect(await screen.findByRole("dialog", { name: "Submit Expense" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Submit" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

describe("ExpenseDetailsPage submission", () => {
  it("requires a receipt before a draft can be submitted", async () => {
    const expense = await givenExpense({ status: "draft", documentIds: [] });

    await renderOwnExpense(expense.id);

    expect(await screen.findByText(/Attach a receipt or supporting document below/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Expense" })).toBeDisabled();
  });

  it("submits a draft with a receipt after confirmation", async () => {
    const expense = await givenExpense({ status: "draft", documentIds: ["document-1"] });
    const { user } = await renderOwnExpense(expense.id);

    await confirmSubmit(user);

    await waitFor(async () => expect(await readExpense(expense.id)).toMatchObject({ status: "submitted" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Submit Expense" })).not.toBeInTheDocument());
  });

  it("shows the policy's reasons when submission is refused and keeps the draft", async () => {
    await givenPolicy({ rules: { maximumAmount: { amount: 500, enforcement: "BLOCK" } } });
    const expense = await givenExpense({ status: "draft", amount: 1_000, documentIds: ["document-1"] });
    const { user } = await renderOwnExpense(expense.id);

    await confirmSubmit(user);

    expect(await screen.findByText("Amount exceeds the maximum of ₹500 per expense.")).toBeInTheDocument();
    expect(await readExpense(expense.id)).toMatchObject({ status: "draft" });
    expect(await auditEventsFor(expense.id)).toEqual([
      expect.objectContaining({ action: "EXPENSE_SUBMISSION_REJECTED" }),
    ]);
  });
});

describe("ExpenseDetailsPage review", () => {
  it("requires a reason to reject and shows the rejection was saved", async () => {
    const expense = await givenExpense({ status: "under_review", title: "Hotel in Pune" });
    const { user } = await renderPage(<ExpenseDetailsPage mode="review" />, {
      path: "/approvals/:id",
      route: `/approvals/${expense.id}`,
      as: "manager",
    });

    await user.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject Expense" });
    const rejectButton = screen.getByRole("button", { name: "Reject Expense" });
    expect(dialog).toContainElement(rejectButton);
    expect(rejectButton).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: /Rejection reason/ }), "Missing itemised bill");
    expect(rejectButton).toBeEnabled();
    await user.click(rejectButton);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await readExpense(expense.id)).toMatchObject({ status: "rejected", rejectionReason: "Missing itemised bill" });
  });
});

describe("ExpenseDetailsPage reimbursement actions", () => {
  function renderAs(id: string, as: "admin" | "finance") {
    return renderPage(<ExpenseDetailsPage mode="default" />, { path: "/expenses/:id", route: `/expenses/${id}`, as });
  }

  it("offers an administrator no reimbursement or cancellation of their own expense", async () => {
    const expense = await givenExpense({ owner: "admin", status: "approved", approvedBy: "user-3", title: "Board dinner" });

    await renderAs(expense.id, "admin");

    expect(await screen.findByRole("heading", { name: "Board dinner" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Reimbursement" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel Expense" })).not.toBeInTheDocument();
  });

  it("lets Finance reimburse the only administrator's expense it approved", async () => {
    const expense = await givenExpense({ owner: "admin", status: "approved", approvedBy: "user-3", title: "Board dinner" });

    await renderAs(expense.id, "finance");

    expect(await screen.findByRole("button", { name: "Start Reimbursement" })).toBeInTheDocument();
  });
});

describe("ExpenseDetailsPage amounts in other currencies", () => {
  const conversion = { originalAmount: 60, originalCurrency: "USD", rate: 94.96, rateDate: "2026-10-16" } as const;

  it("shows the rupee amount with the amount as paid and its exchange rate", async () => {
    const expense = await givenExpense({ amount: 5_697.6, conversion: { ...conversion, source: "ECB" } });

    await renderOwnExpense(expense.id);

    expect(await screen.findByText("Paid as USD 60.00 at 1 USD = ₹94.96, the European Central Bank rate for 16 Oct 2026.")).toBeInTheDocument();
    expect(screen.getAllByText("₹5,697.60").length).toBeGreaterThan(0);
  });

  it("says when an approximate rate was used", async () => {
    const expense = await givenExpense({ amount: 5_697.6, conversion: { ...conversion, source: "REFERENCE" } });

    await renderOwnExpense(expense.id);

    expect(await screen.findByText(
      "Paid as USD 60.00 at 1 USD = ₹94.96, an approximate rate from 16 Oct 2026 used because current rates could not be retrieved.",
    )).toBeInTheDocument();
  });
});

describe("ExpenseDetailsPage after creation", () => {
  it("shows receipts that could not be attached when the expense was created", async () => {
    const expense = await givenExpense({ status: "draft", documentIds: [] });
    const receiptError = "The expense was created, but bill.pdf could not be attached. You can add it below.";

    const { user } = await renderPage(<ExpenseDetailsPage mode="default" />, {
      path: "/expenses/:id",
      route: `/expenses/${expense.id}`,
      state: { receiptError },
      as: "employee",
    });

    expect(await screen.findByText(receiptError)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText(receiptError)).not.toBeInTheDocument();
  });
});
