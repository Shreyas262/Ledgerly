import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { givenBudget, givenExpense, withFixedToday } from "../../../test/fixtures";
import { navigatedTo, renderPage, setupPageTests } from "../../../test/renderPage";
import { DashboardPage } from "./DashboardPage";

setupPageTests();
withFixedToday("2026-10-16");

function renderDashboard(as: "employee" | "manager" = "employee") {
  return renderPage(<DashboardPage />, { path: "/dashboard", as });
}

describe("DashboardPage date range", () => {
  it("stays usable while an end date before the start date is corrected", async () => {
    await givenExpense({ title: "Hotel", amount: 4_000, status: "reimbursed", expenseDate: "2026-10-12" });
    const { user } = await renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Custom" }));
    const start = screen.getByLabelText("Start date");
    const end = screen.getByLabelText("End date");
    fireEvent.change(start, { target: { value: "2026-10-10" } });
    fireEvent.change(end, { target: { value: "2026-10-05" } });

    expect(await screen.findByText("The end date must be on or after the start date.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My Expenses Overview" })).toBeInTheDocument();
    expect(end).toBeEnabled();

    fireEvent.change(end, { target: { value: "2026-10-20" } });

    expect((await screen.findAllByText(/₹4,000/)).length).toBeGreaterThan(0);
    expect(screen.queryByText("The end date must be on or after the start date.")).not.toBeInTheDocument();
  });

  it("narrows the period figures with a preset", async () => {
    await givenExpense({ status: "submitted", amount: 700, expenseDate: "2026-10-03" });
    await givenExpense({ status: "submitted", amount: 900, expenseDate: "2026-02-03" });
    const { user } = await renderDashboard();

    expect(await screen.findByText(/^₹1,600(\.00)? submitted or under review$/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "This month" }));

    expect(await screen.findByText(/^₹700(\.00)? submitted or under review$/)).toBeInTheDocument();
  });
});

describe("DashboardPage attention and recent expenses", () => {
  it("lists drafts to finish and opens them on the Expenses page", async () => {
    await givenExpense({ title: "Taxi", status: "draft", documentIds: [] });
    const { user } = await renderDashboard();

    const attention = await screen.findByRole("region", { name: "Needs your attention" });
    expect(within(attention).getByText("1 draft not yet submitted")).toBeInTheDocument();
    expect(within(attention).getByText("1 needs a receipt before it can be submitted.")).toBeInTheDocument();

    await user.click(within(attention).getByRole("link", { name: "Review Drafts" }));
    expect(await navigatedTo()).toBe("/expenses");
  });

  it("says so when nothing is waiting", async () => {
    await givenBudget();
    await renderDashboard();

    expect(await screen.findByText("You are all caught up")).toBeInTheDocument();
    expect(screen.getByText("You have not created any expenses yet.")).toBeInTheDocument();
  });

  it("shows what is owed and the latest expenses with their status", async () => {
    await givenExpense({ title: "Flight", status: "approved", amount: 2_500, expenseDate: "2026-10-02" });

    await renderDashboard();

    expect(await screen.findByText("1 approved expense waiting for payment")).toBeInTheDocument();
    const recent = screen.getByRole("region", { name: "Recent expenses" });
    expect(within(recent).getByText("Flight")).toBeInTheDocument();
    expect(within(recent).getByText("Approved")).toBeInTheDocument();
  });
});

describe("DashboardPage work queues", () => {
  it("shows a manager the approvals waiting for them", async () => {
    await givenExpense({ status: "submitted", submittedAt: new Date("2026-10-13T09:00:00").toISOString() });

    await renderDashboard("manager");

    const work = await screen.findByRole("region", { name: "Your work" });
    expect(within(work).getByText("Approvals waiting for you")).toBeInTheDocument();
    expect(within(work).getByText("The oldest has waited 3 days.")).toBeInTheDocument();
    expect(within(work).getByRole("link", { name: "Open Approvals" })).toHaveAttribute("href", "/approvals");
  });

  it("warns a manager about a team budget projected to exceed its allocation", async () => {
    await givenBudget();
    // 45,000 of the team's 50,000 by 16 Oct heads for 56,833.91 by 31 Dec.
    await givenExpense({ status: "reimbursed", amount: 45_000, expenseDate: "2026-06-01" });

    await renderDashboard("manager");

    const work = await screen.findByRole("region", { name: "Your work" });
    expect(within(work).getByText("Budgets near their limit")).toBeInTheDocument();
    expect(within(work).getByText((_content, element) =>
      element?.tagName === "LI" && element.textContent === "Engineering team: projected ₹6,833.91 over")).toBeInTheDocument();
  });

  it("shows an employee no work queues", async () => {
    await renderDashboard();

    await screen.findByRole("heading", { name: "My Expenses Overview" });
    expect(screen.queryByRole("region", { name: "Your work" })).not.toBeInTheDocument();
  });
});

describe("DashboardPage add expense button", () => {
  it("opens the expense form while expenses can be created", async () => {
    await givenBudget();
    const { user } = await renderDashboard();

    await user.click(await screen.findByRole("link", { name: "Add Expense" }));

    expect(await navigatedTo()).toBe("/expenses/new");
  });

  it("is not offered while no budget is active, and the reason is shown", async () => {
    await renderDashboard();

    expect(await screen.findByText("You cannot create expenses right now")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add Expense" })).not.toBeInTheDocument();
  });
});
