import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";

import type { Expense } from "../types/expense";
import { apiError } from "../../../mocks/services/apiError";
import { listRecords } from "../../../mocks/services/mockDataService";
import { server } from "../../../test/apiServer";
import { givenBudget, withFixedToday } from "../../../test/fixtures";
import { navigatedTo, renderPage, setupPageTests } from "../../../test/renderPage";
import { CreateExpensePage } from "./CreateExpensePage";

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
