import { screen, waitFor, within } from "@testing-library/react";
import { delay, http } from "msw";
import { describe, expect, it } from "vitest";

import { apiError } from "../../../mocks/services/apiError";
import { saveRecord } from "../../../mocks/services/mockDataService";
import { server } from "../../../test/apiServer";
import { givenExpense, readExpense } from "../../../test/fixtures";
import { navigatedTo, renderPage, setupPageTests } from "../../../test/renderPage";
import { ApprovalsPage } from "./ApprovalPage";

setupPageTests();

function renderApprovals() {
  return renderPage(<ApprovalsPage />, { path: "/approvals", as: "manager" });
}

async function startReviewOf(user: Awaited<ReturnType<typeof renderApprovals>>["user"], confirmLabel: string) {
  await user.click(screen.getByRole("button", { name: "Start Review" }));
  await screen.findByRole("dialog", { name: "Start Review" });
  await user.click(screen.getByRole("button", { name: confirmLabel }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

describe("ApprovalsPage review queue", () => {
  it("lists the team's submitted expenses but not the manager's own", async () => {
    await givenExpense({ owner: "employee", title: "Hotel in Pune" });
    await givenExpense({ owner: "manager", title: "Manager taxi" });

    await renderApprovals();

    expect(await screen.findByText("Hotel in Pune")).toBeInTheDocument();
    expect(screen.queryByText("Manager taxi")).not.toBeInTheDocument();
  });

  it("says when nothing is waiting", async () => {
    await renderApprovals();

    expect(await screen.findByText("There are no expenses waiting for approval.")).toBeInTheDocument();
  });

  it("starts the review after confirmation and opens the expense", async () => {
    const expense = await givenExpense({ owner: "employee", title: "Hotel in Pune" });
    const { user } = await renderApprovals();
    await screen.findByText("Hotel in Pune");

    await user.click(screen.getByRole("button", { name: "Start Review" }));
    expect(await screen.findByRole("dialog", { name: "Start Review" })).toHaveTextContent('Start reviewing "Hotel in Pune"?');
    await user.click(screen.getAllByRole("button", { name: "Start Review" }).at(-1)!);

    expect(await navigatedTo()).toBe(`/approvals/${expense.id}`);
    expect(await readExpense(expense.id)).toMatchObject({ status: "under_review" });
  });

  it("changes nothing when the confirmation is cancelled", async () => {
    const expense = await givenExpense({ owner: "employee", title: "Hotel in Pune" });
    const { user } = await renderApprovals();
    await screen.findByText("Hotel in Pune");

    await startReviewOf(user, "Cancel");

    expect(await readExpense(expense.id)).toMatchObject({ status: "submitted" });
    expect(screen.queryByTestId("current-location")).not.toBeInTheDocument();
  });

  it("explains a conflict when the expense changed after the queue loaded", async () => {
    const expense = await givenExpense({ owner: "employee", title: "Hotel in Pune" });
    const { user } = await renderApprovals();
    await screen.findByText("Hotel in Pune");
    await saveRecord("expenses", { ...expense, status: "under_review" });

    await user.click(screen.getByRole("button", { name: "Start Review" }));
    await screen.findByRole("dialog", { name: "Start Review" });
    await user.click(screen.getAllByRole("button", { name: "Start Review" }).at(-1)!);

    expect(await screen.findByText("Conflict")).toBeInTheDocument();
    expect(
      screen.getByText("This action is no longer available because the expense is now under review. Refresh to see its current status."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/START_REVIEW|under_review/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("current-location")).not.toBeInTheDocument();
  });

  it("shows progress only on the expense whose review is starting", async () => {
    await givenExpense({ owner: "employee", title: "Hotel in Pune" });
    await givenExpense({ owner: "employee", title: "Taxi to airport" });
    const { user } = await renderApprovals();
    await screen.findByText("Hotel in Pune");
    server.use(http.post("/api/expenses/:id/review", async () => {
      // Falls through to the real handler after the delay.
      await delay(300);
    }));

    await user.click(screen.getAllByRole("button", { name: "Start Review" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Start Review" });
    await user.click(within(dialog).getByRole("button", { name: "Start Review" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const cardButtons = screen.getAllByRole("button", { name: "Start Review" });
    expect(cardButtons).toHaveLength(2);
    expect(cardButtons.filter((button) => button.hasAttribute("disabled"))).toHaveLength(1);
    expect(await navigatedTo()).toMatch(/^\/approvals\//);
  });

  it("offers Retry when the queue fails to load", async () => {
    server.use(http.get("/api/approvals", () => apiError(500, "The approval queue is temporarily unavailable.")));

    await renderApprovals();

    expect(await screen.findByText("The approval queue is temporarily unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows access denied without Retry when the queue is refused", async () => {
    server.use(http.get("/api/approvals", () => apiError(403, "You do not have permission to perform this action.")));

    await renderApprovals();

    expect(await screen.findByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
