import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";

import { apiError } from "../../../mocks/services/apiError";
import { server } from "../../../test/apiServer";
import { givenExpense } from "../../../test/fixtures";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { DocumentPanel } from "./DocumentPanel";

setupPageTests();

describe("DocumentPanel", () => {
  it("offers Retry when documents fail to load and does not claim there are none", async () => {
    const expense = await givenExpense({ status: "draft" });
    server.use(http.get("/api/expenses/:id/documents", () => apiError(500, "Documents are unavailable.")));

    await renderPage(<DocumentPanel expenseId={expense.id} canManage />, { as: "employee" });

    expect(await screen.findByText("Documents could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("No documents attached.")).not.toBeInTheDocument();
  });

  it("reports a failed upload once per file with a single summary", async () => {
    const expense = await givenExpense({ status: "draft" });
    server.use(http.post("/api/expenses/:id/documents", () => apiError(422, "Document size cannot exceed 5 MB.")));
    const { user } = await renderPage(<DocumentPanel expenseId={expense.id} canManage />, { as: "employee" });
    await screen.findByText("No documents attached.");

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File(["receipt"], "receipt.png", { type: "image/png" }));
    await user.click(await screen.findByRole("button", { name: "Upload" }));

    expect(await screen.findByText("receipt.png could not be uploaded.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    expect(screen.getByText(/One or more documents could not be uploaded/)).toBeInTheDocument();
    expect(screen.queryByText("Validation failed")).not.toBeInTheDocument();
  });
});
