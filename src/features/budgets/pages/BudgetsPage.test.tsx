import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { givenBudget, givenExpense } from "../../../test/fixtures";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { BudgetsPage } from "./BudgetsPage";

setupPageTests();

describe("BudgetsPage summary", () => {
  it("says by how much spend exceeds the budget instead of showing nothing remaining", async () => {
    await givenBudget({ departments: { "dept-engineering": 50_000 }, teams: { "team-engineering": 10_000 } });
    await givenExpense({ status: "reimbursed", amount: 30_419, expenseDate: "2026-10-01" });

    await renderPage(<BudgetsPage />, { path: "/budgets", as: "manager" });

    // The summary card and the team's progress bar.
    expect(await screen.findAllByText("Over budget by ₹20,419")).toHaveLength(2);
    expect(screen.queryByText("₹0 remaining")).not.toBeInTheDocument();
  });

  it("shows what remains while spend is within the budget", async () => {
    await givenBudget({ departments: { "dept-engineering": 50_000 }, teams: { "team-engineering": 10_000 } });
    await givenExpense({ status: "reimbursed", amount: 4_000, expenseDate: "2026-10-01" });

    await renderPage(<BudgetsPage />, { path: "/budgets", as: "manager" });

    expect(await screen.findByText("₹6,000 remaining")).toBeInTheDocument();
  });
});
