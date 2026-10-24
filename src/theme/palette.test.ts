import { getContrastRatio, type Palette } from "@mui/material/styles";
import { describe, expect, it } from "vitest";

import { createAppTheme } from "./theme";

const TEXT = 4.5;
const NON_TEXT = 3;

const semantic = ["primary", "success", "warning", "error", "info"] as const;
const statuses = ["approved", "pending", "rejected", "draft", "info"] as const;

function expectContrast(foreground: string, background: string, minimum: number) {
  expect(getContrastRatio(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(minimum);
}

describe.each(["light", "dark"] as const)("%s palette", (mode) => {
  const palette: Palette = createAppTheme(mode).palette;
  const { background, text } = palette;
  const surfaces = [background.default, background.paper, background.raised, background.subtle];

  it("keeps body and secondary text readable on every surface", () => {
    for (const surface of surfaces) {
      expectContrast(text.primary, surface, TEXT);
      expectContrast(text.secondary, surface, TEXT);
    }
  });

  it("keeps semantic colours readable as text and as filled labels", () => {
    for (const color of semantic) {
      expectContrast(palette[color].main, background.paper, TEXT);
      expectContrast(palette[color].contrastText, palette[color].main, TEXT);
    }
  });

  it("keeps status chip text readable on its tone", () => {
    for (const status of statuses) {
      expectContrast(palette.status[status].fg, palette.status[status].bg, TEXT);
    }
  });

  it("keeps avatar initials and tile icons readable on the accent tone", () => {
    expectContrast(palette.accentTone.fg, palette.accentTone.bg, TEXT);
  });

  it("keeps field outlines and single-series chart marks visible", () => {
    for (const surface of surfaces) {
      expectContrast(palette.inputBorder, surface, NON_TEXT);
    }
    expectContrast(palette.chart.series, background.paper, NON_TEXT);
  });

  it("keeps navigation and brand panel text readable", () => {
    for (const shell of [palette.sidebar, palette.brand]) {
      expectContrast(shell.text, shell.background, TEXT);
      expectContrast(shell.textMuted, shell.background, TEXT);
      expectContrast(shell.activeText, shell.background, TEXT);
      expectContrast(shell.activeIcon, shell.background, NON_TEXT);
    }
  });
});

describe("light palette", () => {
  it("keeps the selected navigation item readable", () => {
    const { sidebar } = createAppTheme("light").palette;

    expectContrast(sidebar.activeText, sidebar.activeBackground, TEXT);
  });
});

describe("dark palette", () => {
  it("fills contained primary and error buttons with a colour that carries white text", () => {
    const { primary, error } = createAppTheme("dark").palette;

    expectContrast("#FFFFFF", primary.dark, TEXT);
    expectContrast("#FFFFFF", error.dark, TEXT);
  });
});
