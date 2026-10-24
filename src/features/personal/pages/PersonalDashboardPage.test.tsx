import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { apiFetch, demoAccounts, signIn } from "../../../test/apiServer";
import { withFixedToday } from "../../../test/fixtures";
import { navigatedTo, renderPage, setupPageTests } from "../../../test/renderPage";
import { PersonalDashboardPage } from "./PersonalDashboardPage";
import { PersonalExpensesPage } from "./PersonalExpensesPage";

setupPageTests();
withFixedToday("2026-10-19");

/** October: a ₹31,000 budget, two ₹9,500 expenses without receipts. */
async function givenOctober() {
  const cookie = await signIn(demoAccounts.personal.email, demoAccounts.personal.password);
  await apiFetch("/api/personal/budgets", { method: "POST", body: JSON.stringify({ month: "2026-10", amount: 31_000, typeLimits: [] }) }, cookie);
  for (const [description, expenseDate] of [["Weekly shop", "2026-10-05"], ["Train pass", "2026-10-10"]]) {
    await apiFetch(
      "/api/personal/expenses",
      { method: "POST", body: JSON.stringify({ type: "GROCERIES", paymentMethod: "UPI", description, expenseDate, amount: 9_500 }) },
      cookie,
    );
  }
}

const renderDashboard = () => renderPage(<PersonalDashboardPage />, { path: "/personal/dashboard", as: "personal" });

describe("PersonalDashboardPage budget pace", () => {
  it("shows what is left per day and where spending is heading", async () => {
    await givenOctober();
    await renderDashboard();

    expect(await screen.findByText(/a day left for the remaining 13 days/)).toHaveTextContent("₹923.08 a day left for the remaining 13 days");
    expect(screen.getByText(/At this pace you will spend ₹31,000(\.00)? this month, within budget\./)).toBeInTheDocument();
    expect(screen.getByText(/An even pace would have spent ₹19,000(\.00)? by today\./)).toBeInTheDocument();
  });
});

describe("PersonalDashboardPage missing receipts", () => {
  it("counts this month's expenses without a receipt and opens them", async () => {
    await givenOctober();
    const { user } = await renderDashboard();

    const notice = (await screen.findByText("2 expenses this month have no receipt.")).closest(".MuiAlert-root") as HTMLElement;
    await user.click(within(notice).getByRole("link", { name: "Review Expenses" }));

    expect(await navigatedTo()).toBe("/personal/expenses");
  });

  it("opens the expense list filtered to expenses without a receipt", async () => {
    await givenOctober();

    await renderPage(<PersonalExpensesPage />, {
      path: "/personal/expenses",
      as: "personal",
      state: { filters: { receipt: "missing", dateFrom: "2026-10-01", dateTo: "2026-10-31" } },
    });

    expect(await screen.findByText("Weekly shop")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Receipt" })).toHaveTextContent("No receipt");
  });
});

describe("PersonalDashboardPage add expense button", () => {
  it("opens the expense form", async () => {
    const { user } = await renderDashboard();

    await user.click(await screen.findByRole("link", { name: "Add Expense" }));

    expect(await navigatedTo()).toBe("/personal/expenses/new");
  });
});
