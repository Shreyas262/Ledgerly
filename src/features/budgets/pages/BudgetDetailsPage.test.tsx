import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getRecord } from "../../../mocks/services/mockDataService";
import { givenBudget } from "../../../test/fixtures";
import { navigatedTo, renderPage, setupPageTests } from "../../../test/renderPage";
import { BudgetDetailsPage } from "./BudgetDetailsPage";

setupPageTests();

describe("BudgetDetailsPage closed budget", () => {
  it("says that reimbursements still count against a closed budget", async () => {
    const { budget } = await givenBudget({ status: "closed" });

    await renderPage(<BudgetDetailsPage />, { path: "/budgets/:id", route: `/budgets/${budget.id}`, as: "admin" });

    expect(await screen.findByText(
      "This budget is closed. No new expenses can be created in its period, but expenses already submitted are still reviewed, and their reimbursements count against this budget.",
    )).toBeInTheDocument();
  });
});

describe("BudgetDetailsPage deleting a draft", () => {
  it("deletes a draft after confirmation and returns to the budgets", async () => {
    const { budget } = await givenBudget({ status: "draft" });
    const { user } = await renderPage(<BudgetDetailsPage />, { path: "/budgets/:id", route: `/budgets/${budget.id}`, as: "admin" });

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Delete Budget" })).getByRole("button", { name: "Delete" }));

    expect(await navigatedTo()).toBe("/budgets");
    expect(await getRecord("budgets", budget.id)).toBeUndefined();
  });

  it("offers no deletion for an active budget", async () => {
    const { budget } = await givenBudget();

    await renderPage(<BudgetDetailsPage />, { path: "/budgets/:id", route: `/budgets/${budget.id}`, as: "admin" });

    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
