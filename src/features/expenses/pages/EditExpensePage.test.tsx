import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";

import { apiError } from "../../../mocks/services/apiError";
import { saveRecord } from "../../../mocks/services/mockDataService";
import { server } from "../../../test/apiServer";
import { givenExpense, readExpense } from "../../../test/fixtures";
import { navigatedTo, renderPage, setupPageTests } from "../../../test/renderPage";
import { EditExpensePage } from "./EditExpensePage";

setupPageTests();

function renderEditPage(id: string) {
  return renderPage(<EditExpensePage />, { path: "/expenses/:id/edit", route: `/expenses/${id}/edit`, as: "employee" });
}

describe("EditExpensePage", () => {
  it("starts from the draft's values and saves the changes after confirmation", async () => {
    const expense = await givenExpense({ status: "draft", title: "Client lunch", amount: 1_000 });
    const { user } = await renderEditPage(expense.id);

    const title = await screen.findByRole("textbox", { name: "Title" });
    expect(title).toHaveValue("Client lunch");
    expect(screen.getByRole("spinbutton", { name: "Amount" })).toHaveValue(1000);

    await user.clear(title);
    await user.type(title, "Client dinner");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await user.click(await screen.findByRole("button", { name: "Save" }));

    expect(await navigatedTo()).toBe(`/expenses/${expense.id}`);
    expect(await readExpense(expense.id)).toMatchObject({ title: "Client dinner", amount: 1_000, status: "draft" });
  });

  it("does not ask to save an amount that is not greater than zero", async () => {
    const expense = await givenExpense({ status: "draft", amount: 1_000 });
    const { user } = await renderEditPage(expense.id);

    const amount = await screen.findByRole("spinbutton", { name: "Amount" });
    await user.clear(amount);
    await user.type(amount, "0");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await readExpense(expense.id)).toMatchObject({ amount: 1_000 });
  });

  it("refreshes the form with the latest values after a conflict", async () => {
    const expense = await givenExpense({ status: "draft", title: "Client lunch" });
    server.use(
      http.put("/api/expenses/:id", () => apiError(409, "This expense was changed by someone else. Refresh to see the latest version.")),
    );
    const { user } = await renderEditPage(expense.id);
    await screen.findByRole("textbox", { name: "Title" });

    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Conflict")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await saveRecord("expenses", { ...expense, title: "Client lunch (updated)", updatedAt: new Date(Date.now() + 1_000).toISOString() });
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Client lunch (updated)"));
  });

  it("explains that only drafts can be edited", async () => {
    const expense = await givenExpense({ status: "submitted" });

    await renderEditPage(expense.id);

    expect(await screen.findByText("Only draft expenses can be edited.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
  });

  it("does not reveal another employee's draft", async () => {
    const expense = await givenExpense({ status: "draft", owner: "manager" });

    await renderEditPage(expense.id);

    expect(await screen.findByText("This expense does not exist or is not available to you.")).toBeInTheDocument();
  });
});
