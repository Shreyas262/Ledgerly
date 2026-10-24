import { Button, Dialog, Fab, MenuItem, Select, TextField, ThemeProvider } from "@mui/material";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { SELECT_MENU_MAX_HEIGHT } from "./components";
import { createAppTheme } from "./theme";

const options = Array.from({ length: 30 }, (_, index) => `Option ${index + 1}`);

function LongSelect() {
  const [value, setValue] = useState("");
  return (
    <Select value={value} displayEmpty onChange={(event) => setValue(event.target.value)} inputProps={{ "aria-label": "Choice" }}>
      <MenuItem value="">All options</MenuItem>
      {options.map((option) => (
        <MenuItem key={option} value={option}>{option}</MenuItem>
      ))}
    </Select>
  );
}

function renderLongSelect() {
  render(
    <ThemeProvider theme={createAppTheme("light")}>
      <LongSelect />
    </ThemeProvider>,
  );
}

describe("select menus", () => {
  it("caps the height of a long option list so it scrolls", () => {
    renderLongSelect();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Choice" }));

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(31);
    expect(listbox.closest(".MuiPaper-root")).toHaveStyle({ maxHeight: `${SELECT_MENU_MAX_HEIGHT}px` });
  });

  it("still selects the option that is clicked", async () => {
    const user = userEvent.setup();
    renderLongSelect();

    await user.click(screen.getByRole("combobox", { name: "Choice" }));
    await user.click(await screen.findByRole("option", { name: "Option 12" }));

    expect(screen.getByRole("combobox", { name: "Choice" })).toHaveTextContent("Option 12");
  });
});

describe("themed surfaces and controls", () => {
  it("fills contained primary and error buttons with a solid colour and a white label in dark mode", () => {
    const { palette } = createAppTheme("dark");
    render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <Button variant="contained">Save Changes</Button>
        <Button variant="contained" color="error">Delete Budget</Button>
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Save Changes" })).toHaveStyle({ backgroundColor: palette.primary.dark, color: "#FFFFFF" });
    expect(screen.getByRole("button", { name: "Delete Budget" })).toHaveStyle({ backgroundColor: palette.error.dark, color: "#FFFFFF" });
  });

  it("fills the floating action button with a solid colour and a white icon in dark mode", () => {
    const { palette } = createAppTheme("dark");
    render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <Fab color="primary" aria-label="Add Expense">+</Fab>
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Add Expense" })).toHaveStyle({ backgroundColor: palette.primary.dark, color: "#FFFFFF" });
  });

  it.each(["light", "dark"] as const)("outlines text fields with the field border colour in %s mode", (mode) => {
    const theme = createAppTheme(mode);
    render(
      <ThemeProvider theme={theme}>
        <TextField label="Merchant" />
      </ThemeProvider>,
    );

    const outline = screen.getByRole("textbox", { name: "Merchant" }).parentElement?.querySelector(".MuiOutlinedInput-notchedOutline");
    expect(outline).toHaveStyle({ borderColor: theme.palette.inputBorder });
  });

  it("raises dialogs above cards in dark mode", () => {
    const theme = createAppTheme("dark");
    render(
      <ThemeProvider theme={theme}>
        <Dialog open aria-label="Confirm">Content</Dialog>
      </ThemeProvider>,
    );

    expect(screen.getByRole("dialog").closest(".MuiPaper-root")).toHaveStyle({ backgroundColor: theme.palette.background.raised });
    expect(theme.palette.background.raised).not.toBe(theme.palette.background.paper);
  });
});
