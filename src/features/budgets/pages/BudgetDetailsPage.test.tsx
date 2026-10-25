import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getRecord } from "../../../mocks/services/mockDataService";
import { givenBudget, givenExpense } from "../../../test/fixtures";
import { navigatedTo, renderPage, setupPageTests } from "../../../test/renderPage";
import { formatDate, toDateOnly } from "../../../utils/format";
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

// §28.19: the forecast panel and level notes.
describe("BudgetDetailsPage forecast", () => {
  const day = (offset: number) => toDateOnly(new Date(Date.now() + offset * 86_400_000));

  /** 30 of 60 days gone; 15,000 reimbursed and 15,000 committed head for 60,000 against the team's 50,000. */
  async function givenTeamHeadingOver() {
    const scenario = await givenBudget({
      startDate: day(-29),
      endDate: day(30),
      departments: { "dept-engineering": 100_000 },
      teams: { "team-engineering": 50_000 },
    });
    await givenExpense({ status: "reimbursed", amount: 15_000, expenseDate: day(-20) });
    await givenExpense({ status: "approved", amount: 15_000, expenseDate: day(-10) });
    return scenario;
  }

  it("states the manager's team forecast in words, with committed spend kept apart", async () => {
    const { budget } = await givenTeamHeadingOver();

    await renderPage(<BudgetDetailsPage />, { path: "/budgets/:id", route: `/budgets/${budget.id}`, as: "manager" });

    expect(await screen.findByText(
      `At this pace, spend will reach ₹60,000 by ${formatDate(day(30))}, ₹10,000 over budget. The budget runs out around ${formatDate(day(20))}.`,
    )).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Budget forecast chart\./ })).toBeInTheDocument();
    expect(screen.getByText("₹15,000 committed: approved, awaiting reimbursement")).toBeInTheDocument();
    expect(screen.getByText(`Projected to exceed by ₹10,000 around ${formatDate(day(20))}`)).toBeInTheDocument();
    expect(screen.getByText(/Spend includes reimbursed expenses only\. Committed spend is approved and awaiting reimbursement/)).toBeInTheDocument();
  });

  it("shows no forecast for a closed budget", async () => {
    const { budget } = await givenBudget({ status: "closed" });

    await renderPage(<BudgetDetailsPage />, { path: "/budgets/:id", route: `/budgets/${budget.id}`, as: "admin" });

    expect(await screen.findByText(/This budget is closed\./)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Forecast" })).not.toBeInTheDocument();
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
