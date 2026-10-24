import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  it("shows the wordmark and subtitle, with the logo hidden from assistive technology", () => {
    const { container } = render(<BrandMark subtitle="Organization workspace" />);

    expect(screen.getByText("Ledgerly")).toBeInTheDocument();
    expect(screen.getByText("Organization workspace")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links home when given a path", () => {
    render(
      <MemoryRouter>
        <BrandMark to="/" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Ledgerly home" })).toHaveAttribute("href", "/");
  });
});
