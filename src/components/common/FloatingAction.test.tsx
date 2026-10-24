import { ThemeProvider } from "@mui/material";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { createAppTheme } from "../../theme/theme";
import { FloatingAction } from "./FloatingAction";
import { PlusIcon } from "./PlusIcon";

function renderAction() {
  render(
    <ThemeProvider theme={createAppTheme("light")}>
      <MemoryRouter>
        <FloatingAction label="Add Expense" to="/expenses/new" icon={<PlusIcon />} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function scrollTo(y: number) {
  act(() => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    fireEvent.scroll(window);
  });
}

afterEach(() => scrollTo(0));

describe("FloatingAction", () => {
  it("opens labelled and links to the action", () => {
    renderAction();

    const action = screen.getByRole("link", { name: "Add Expense" });
    expect(action).toHaveAttribute("href", "/expenses/new");
    expect(screen.getByTestId("floating-action-label")).toHaveAttribute("aria-hidden", "false");
    // The plus is decorative: the label names the action.
    expect(action.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("folds to its icon after scrolling down and keeps its name", () => {
    renderAction();

    scrollTo(400);

    expect(screen.getByTestId("floating-action-label")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: "Add Expense" })).toBeInTheDocument();
  });

  it("unfolds again near the top", () => {
    renderAction();
    scrollTo(400);

    scrollTo(20);

    expect(screen.getByTestId("floating-action-label")).toHaveAttribute("aria-hidden", "false");
  });
});
