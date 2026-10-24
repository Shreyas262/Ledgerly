import { describe, expect, it } from "vitest";

import { createAppTheme } from "../../theme/theme";
import { buildReport, shareCell } from "./pdfDocument";

const { palette } = createAppTheme("light");

describe("PDF report colours", () => {
  it("use the light theme's text, secondary text and divider colours", () => {
    const report = buildReport({ title: "Expense Report", details: ["1 Oct 2026 to 19 Oct 2026"], generatedBy: "Asha Kumar", content: [] });

    expect(report.defaultStyle?.color).toBe(palette.text.primary);
    expect(report.styles?.subtitle?.color).toBe(palette.text.secondary);
    expect(report.styles?.tableHeader?.color).toBe(palette.text.secondary);
  });

  it("draw share bars in the single-series chart colour on the chart track", () => {
    const cell = shareCell(0.4) as { columns: { canvas?: { color?: string }[] }[] };
    const [track, bar] = cell.columns[0].canvas ?? [];

    expect(track.color).toBe(palette.chart.track);
    expect(bar.color).toBe(palette.chart.series);
  });
});
