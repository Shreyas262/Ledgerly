import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { givenExpense, givenPolicy, readExpense } from "../../../test/fixtures";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { ExpensesPage } from "./ExpensesPage";

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
