import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";

import { apiError } from "../../../mocks/services/apiError";
import { listRecords, saveRecord } from "../../../mocks/services/mockDataService";
import type { StoredExpenseComment } from "../../../mocks/services/expenseCommentService";
import { server } from "../../../test/apiServer";
import { givenExpense } from "../../../test/fixtures";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { ExpenseDetailsPage } from "../pages/ExpenseDetailsPage";
import { ExpenseComments } from "./ExpenseComments";

setupPageTests();

function givenComment(expenseId: string, authorId: string, body: string, createdAt: string) {
  return saveRecord<StoredExpenseComment>("expenseComments", {
    id: crypto.randomUUID(),
    organizationId: "org-1",
    expenseId,
    authorId,
    body,
    createdAt,
  });
}

describe("ExpenseComments", () => {
  it("shows the discussion oldest first with who wrote each comment and when", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review" });
    await givenComment(expense.id, "user-1", "Attached it now.\nThank you.", "2026-10-02T08:00:00.000Z");
    await givenComment(expense.id, "user-2", "Please attach the GST invoice.", "2026-10-01T08:00:00.000Z");

    await renderPage(<ExpenseComments expenseId={expense.id} />, { as: "employee" });

    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Please attach the GST invoice.");
    expect(within(items[0]).getByText("Manager")).toBeInTheDocument();
    expect(within(items[0]).queryByText("You")).not.toBeInTheDocument();
    expect(within(items[1]).getByText("You")).toBeInTheDocument();
    // 08:00 UTC falls on 2 October in every time zone the app is used in.
    expect(within(items[1]).getByText(/^2 Oct 2026, \d{1,2}:\d{2} (am|pm)$/)).toBeInTheDocument();
    expect(within(items[1]).getByText(/Attached it now\.\s+Thank you\./)).toBeInTheDocument();
  });

  it("posts a comment only after confirmation and clears the field", async () => {
    const expense = await givenExpense({ owner: "employee", status: "submitted" });
    const { user } = await renderPage(<ExpenseComments expenseId={expense.id} />, { as: "manager" });
    expect(await screen.findByText("No comments yet")).toBeInTheDocument();

    const field = screen.getByRole("textbox", { name: "Add a comment" });
    await user.type(field, "Which client was this for?");
    await user.click(screen.getByRole("button", { name: "Post Comment" }));
    const dialog = await screen.findByRole("dialog", { name: "Post Comment" });
    expect(dialog).toHaveTextContent("Post this comment? Comments cannot be edited or removed.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await listRecords("expenseComments")).toEqual([]);
    expect(field).toHaveValue("Which client was this for?");

    await user.click(screen.getByRole("button", { name: "Post Comment" }));
    await user.click(await screen.findByRole("button", { name: "Post" }));

    expect(await screen.findByText("Which client was this for?", { selector: "p" })).toBeInTheDocument();
    expect(field).toHaveValue("");
    expect(await listRecords("expenseComments")).toEqual([expect.objectContaining({ body: "Which client was this for?" })]);
  });

  it("does not offer posting an empty comment", async () => {
    const expense = await givenExpense({ owner: "employee", status: "submitted" });
    const { user } = await renderPage(<ExpenseComments expenseId={expense.id} />, { as: "employee" });

    await user.type(await screen.findByRole("textbox", { name: "Add a comment" }), "   ");

    expect(screen.getByRole("button", { name: "Post Comment" })).toBeDisabled();
  });

  it("shows the reason under the field and keeps the text when the comment is refused", async () => {
    const expense = await givenExpense({ owner: "employee", status: "submitted" });
    server.use(
      http.post("/api/expenses/:id/comments", () =>
        apiError(422, "Please correct the highlighted fields.", "VALIDATION_ERROR", { fieldErrors: { body: "Use at most 1000 characters." } }),
      ),
    );
    const { user } = await renderPage(<ExpenseComments expenseId={expense.id} />, { as: "employee" });

    const field = await screen.findByRole("textbox", { name: "Add a comment" });
    await user.type(field, "A long explanation");
    await user.click(screen.getByRole("button", { name: "Post Comment" }));
    await user.click(await screen.findByRole("button", { name: "Post" }));

    await waitFor(() => expect(field).toHaveAccessibleDescription("Use at most 1000 characters."));
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveValue("A long explanation");
  });

  it("keeps the thread readable and explains why no comments can be added", async () => {
    const expense = await givenExpense({ owner: "employee", status: "reimbursed" });
    await givenComment(expense.id, "user-3", "Paid on 5 October.", "2026-10-05T08:00:00.000Z");

    await renderPage(<ExpenseComments expenseId={expense.id} />, { as: "employee" });

    expect(await screen.findByText("Paid on 5 October.")).toBeInTheDocument();
    expect(screen.getByText("Comments are closed because this expense has been reimbursed.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Add a comment" })).not.toBeInTheDocument();
  });

  it("offers Retry when comments cannot be loaded", async () => {
    const expense = await givenExpense({ owner: "employee", status: "submitted" });
    server.use(http.get("/api/expenses/:id/comments", () => apiError(500, "Comments are unavailable.")));

    await renderPage(<ExpenseComments expenseId={expense.id} />, { as: "employee" });

    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("No comments yet")).not.toBeInTheDocument();
  });

  it("appears on the review page for the reviewer", async () => {
    const expense = await givenExpense({ owner: "employee", status: "under_review" });
    await givenComment(expense.id, "user-1", "The receipt is attached.", "2026-10-01T08:00:00.000Z");

    await renderPage(<ExpenseDetailsPage mode="review" />, { path: "/approvals/:id", route: `/approvals/${expense.id}`, as: "manager" });

    expect(await screen.findByRole("heading", { name: "Comments" })).toBeInTheDocument();
    expect(await screen.findByText("The receipt is attached.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Add a comment" })).toBeInTheDocument();
  });
});
