import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PersonalExpense } from "../types/personal";
import { saveRecord } from "../../../mocks/services/mockDataService";
import { downloadPdf } from "../../../services/pdf/downloadPdf";
import { withFixedToday } from "../../../test/fixtures";
import { pdfText } from "../../../test/pdfText";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { PersonalAnalyticsPage } from "./PersonalAnalyticsPage";

// Creating the file runs pdfmake in the browser; the tests check what would be downloaded.
vi.mock("../../../services/pdf/downloadPdf", () => ({ downloadPdf: vi.fn() }));

setupPageTests();
withFixedToday("2026-10-16");

describe("PersonalAnalyticsPage PDF export", () => {
  beforeEach(() => {
    vi.mocked(downloadPdf).mockReset();
  });

  it("downloads the analytics of the chosen months", async () => {
    await saveRecord<PersonalExpense>("personalExpenses", {
      id: "personal-expense-1",
      ownerId: "user-personal-1",
      type: "GROCERIES",
      amount: 860,
      currency: "INR",
      expenseDate: "2026-10-12",
      description: "Weekly groceries",
      paymentMethod: "UPI",
      documentIds: [],
      createdAt: "2026-10-12T10:00:00.000Z",
      updatedAt: "2026-10-12T10:00:00.000Z",
    });
    const { user } = await renderPage(<PersonalAnalyticsPage />, { path: "/personal/analytics", as: "personal" });

    const button = await screen.findByRole("button", { name: "Export PDF" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    await waitFor(() => expect(downloadPdf).toHaveBeenCalledTimes(1));
    const [report, fileName] = vi.mocked(downloadPdf).mock.calls[0];
    const text = pdfText(report);
    // The default range is the last six months.
    expect(text).toContain("May 2026 to October 2026");
    expect(text).toContain("Groceries");
    expect(text).toContain("Weekly groceries · 12 Oct 2026");
    expect(fileName).toBe("ledgerly-personal-analytics-2026-05-to-2026-10.pdf");
  });
});
