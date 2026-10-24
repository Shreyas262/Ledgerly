import { ThemeProvider } from "@mui/material";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createAppTheme } from "../../theme/theme";
import { UserAvatar } from "./UserAvatar";

function renderAvatar(name: string | undefined, size?: "small" | "medium" | "large") {
  const theme = createAppTheme("dark");
  render(
    <ThemeProvider theme={theme}>
      <UserAvatar name={name} size={size} />
    </ThemeProvider>,
  );
  return theme;
}

describe("UserAvatar", () => {
  it("shows up to two initials, hidden from assistive technology", () => {
    renderAvatar("asha  kumar rao");

    const avatar = screen.getByText("AK");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
  });

  it("sizes the initials with the avatar", () => {
    renderAvatar("Asha Kumar", "large");

    expect(screen.getByText("AK")).toHaveStyle({ width: "56px", height: "56px", fontSize: "22.4px" });
  });

  it("uses the accent tone", () => {
    const theme = renderAvatar("Asha Kumar");

    expect(screen.getByText("AK")).toHaveStyle({ backgroundColor: theme.palette.accentTone.bg, color: theme.palette.accentTone.fg });
  });

  it("renders nothing to read for a missing name", () => {
    renderAvatar(undefined);

    expect(document.querySelector(".MuiAvatar-root")).toHaveTextContent("");
  });
});
