import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("shows the default title and message", () => {
    render(<EmptyState />);

    expect(screen.getByRole("heading", { name: "No records found" })).toBeInTheDocument();
    expect(screen.getByText("There is nothing to display yet.")).toBeInTheDocument();
  });

  it("shows a custom message and action", () => {
    render(<EmptyState title="No expenses" message="Create your first expense." action={<button>New Expense</button>} />);

    expect(screen.getByRole("heading", { name: "No expenses" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Expense" })).toBeInTheDocument();
  });
});
