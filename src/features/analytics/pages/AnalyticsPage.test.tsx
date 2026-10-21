import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { downloadPdf } from "../../../services/pdf/downloadPdf";
import { givenExpense } from "../../../test/fixtures";
import { pdfText } from "../../../test/pdfText";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { toDateOnly } from "../../../utils/format";
import { AnalyticsPage } from "./AnalyticsPage";

// Creating the file runs pdfmake in the browser; the tests check what would be downloaded.
vi.mock("../../../services/pdf/downloadPdf", () => ({ downloadPdf: vi.fn() }));

setupPageTests();

describe("AnalyticsPage PDF export", () => {
  beforeEach(() => {
    vi.mocked(downloadPdf).mockReset();
  });

  it("downloads the filtered summary for the viewer's scope", async () => {
    await givenExpense({ title: "Flight", type: "TRAVEL", amount: 8_000, status: "reimbursed", expenseDate: toDateOnly() });
    const { user } = await renderPage(<AnalyticsPage />, { path: "/analytics", as: "admin" });

    const button = await screen.findByRole("button", { name: "Export PDF" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    await waitFor(() => expect(downloadPdf).toHaveBeenCalledTimes(1));
    const [report, fileName] = vi.mocked(downloadPdf).mock.calls[0];
    const text = pdfText(report);
    expect(text).toContain("Organization-wide");
    expect(text).toContain("Spend includes reimbursed expenses only. Amounts are in rupees.");
    expect(text).toContain("Travel");
    expect(fileName).toMatch(/^ledgerly-analytics-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it("explains when the PDF could not be created", async () => {
    vi.mocked(downloadPdf).mockRejectedValue(new Error("Font missing"));
    const { user } = await renderPage(<AnalyticsPage />, { path: "/analytics", as: "admin" });

    const button = await screen.findByRole("button", { name: "Export PDF" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(await screen.findByText("The PDF could not be created. Try again.")).toBeInTheDocument();
  });
});
