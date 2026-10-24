import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { givenExpense } from "../../../test/fixtures";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { DashboardPage } from "./DashboardPage";

setupPageTests();

describe("DashboardPage date range", () => {
  it("stays usable while an end date before the start date is corrected", async () => {
    await givenExpense({ title: "Hotel", amount: 4_000, status: "reimbursed", expenseDate: "2026-10-12" });
    await renderPage(<DashboardPage />, { path: "/dashboard", as: "employee" });

    const start = await screen.findByLabelText("Start date");
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
});
