import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { givenBudget } from "../../../test/fixtures";
import { renderPage, setupPageTests } from "../../../test/renderPage";
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
