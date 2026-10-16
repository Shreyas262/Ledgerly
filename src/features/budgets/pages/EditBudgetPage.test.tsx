import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getRecord } from "../../../mocks/services/mockDataService";
import { givenBudget } from "../../../test/fixtures";
import { navigatedTo, renderPage, setupPageTests } from "../../../test/renderPage";
import { EditBudgetPage } from "./EditBudgetPage";

setupPageTests();

function renderEditBudget(id: string) {
  return renderPage(<EditBudgetPage />, { path: "/budgets/:id/edit", route: `/budgets/${id}/edit`, as: "admin" });
}

describe("EditBudgetPage", () => {
  it("starts from the budget's values and saves the changes after confirmation", async () => {
    const { budget } = await givenBudget({ amount: 300_000 });
    const { user } = await renderEditBudget(budget.id);

    const amount = await screen.findByRole("spinbutton", { name: "Organization budget amount" });
    expect(amount).toHaveValue(300_000);
    expect(screen.getByRole("textbox", { name: "Organization budget name" })).toHaveValue(budget.name);

    await user.clear(amount);
    await user.type(amount, "350000");
    await user.click(screen.getByRole("button", { name: "Save Budget" }));
    await user.click(await screen.findByRole("button", { name: "Save" }));

    expect(await navigatedTo()).toBe(`/budgets/${budget.id}`);
    expect(await getRecord("budgets", budget.id)).toMatchObject({ amount: 350_000 });
  });

  it("explains an invalid period as an alert and saves nothing", async () => {
    const { budget } = await givenBudget({ startDate: "2026-01-01", endDate: "2026-12-31" });
    const { user } = await renderEditBudget(budget.id);

    const end = await screen.findByLabelText(/End date/);
    await user.clear(end);
    await user.type(end, "2025-12-31");
    await user.click(screen.getByRole("button", { name: "Save Budget" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A valid budget period is required.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await getRecord("budgets", budget.id)).toMatchObject({ endDate: "2026-12-31" });
  });
});
