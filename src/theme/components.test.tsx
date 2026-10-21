import { MenuItem, Select, ThemeProvider } from "@mui/material";
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
