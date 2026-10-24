import { ThemeProvider } from "@mui/material";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createAppTheme } from "../../../theme/theme";
import { KpiTrendCard } from "./KpiTrendCard";

function renderCard(current: number, previous: number, precision?: number) {
  render(
    <ThemeProvider theme={createAppTheme("light")}>
      <KpiTrendCard label="Average time to reimbursement" value={`${current.toFixed(1)} days`} current={current} previous={previous} precision={precision} lowerIsBetter />
    </ThemeProvider>,
  );
}

describe("KpiTrendCard", () => {
  it("reports no change when both periods show the same value", () => {
    renderCard(0.019, 0.02, 1);

    expect(screen.getByText("No change from the previous period")).toBeInTheDocument();
  });

  it("reports the change when the shown values differ", () => {
    renderCard(1.5, 2, 1);

    expect(screen.getByText("25% lower than the previous period")).toBeInTheDocument();
  });
});

describe("KpiTrendCard verdict", () => {
  it("says in words whether the change is good, not only through colour", async () => {
    renderCard(1.5, 2, 1);

    const icon = screen.getByRole("img", { name: "Better than the previous period" });
    await userEvent.hover(icon);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Better than the previous period");
  });

  it("calls a rise in a lower-is-better figure worse", () => {
    renderCard(3, 2, 1);

    expect(screen.getByRole("img", { name: "Worse than the previous period" })).toBeInTheDocument();
  });
});
