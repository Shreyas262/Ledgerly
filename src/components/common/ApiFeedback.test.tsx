import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { navigatedTo, renderPage, setupPageTests } from "../../test/renderPage";
import { ApiFeedback } from "./ApiFeedback";

setupPageTests();

const apiError = (status: number, message: string, details?: Record<string, unknown>) => ({
  status,
  code: "ANY",
  message,
  details,
});

describe("ApiFeedback", () => {
  it("asks the user to sign in again after a 401", async () => {
    const { user } = await renderPage(<ApiFeedback error={apiError(401, "Please sign in to continue.")} />);

    expect(screen.getByText("Session required")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await navigatedTo()).toBe("/auth/login");
  });

  it("shows the server's reason for a 403", async () => {
    await renderPage(<ApiFeedback error={apiError(403, "You cannot review your own expense.")} />);

    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.getByText("You cannot review your own expense.")).toBeInTheDocument();
  });

  it("offers Refresh for a 409 when the page can reload the record", async () => {
    const onReconcile = vi.fn();
    const { user } = await renderPage(
      <ApiFeedback error={apiError(409, "The expense changed.")} onReconcile={onReconcile} />,
    );

    expect(screen.getByText("Conflict")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(onReconcile).toHaveBeenCalledOnce();
  });

  it("shows a business rule from a 422 in place of the general message", async () => {
    await renderPage(
      <ApiFeedback error={apiError(422, "Request not accepted.", { businessRule: "₹5,000 is still available." })} />,
    );

    expect(screen.getByText("Business rule")).toBeInTheDocument();
    expect(screen.getByText("₹5,000 is still available.")).toBeInTheDocument();
  });

  it("shows a validation message from a 422 without a business rule", async () => {
    await renderPage(<ApiFeedback error={apiError(422, "Please correct the highlighted fields.")} />);

    expect(screen.getByText("Validation failed")).toBeInTheDocument();
    expect(screen.getByText("Please correct the highlighted fields.")).toBeInTheDocument();
  });

  it("offers Retry only when a load failed", async () => {
    const onRetry = vi.fn();
    const { user } = await renderPage(
      <ApiFeedback error={apiError(500, "Temporarily unavailable.")} context="load" onRetry={onRetry} />,
    );

    expect(screen.getByText("The data could not be loaded")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not offer Retry when an action failed", async () => {
    await renderPage(<ApiFeedback error={apiError(500, "Temporarily unavailable.")} onRetry={vi.fn()} />);

    expect(screen.getByText("The action could not be completed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("renders nothing without an error", async () => {
    await renderPage(<div data-testid="page"><ApiFeedback error={undefined} /></div>);

    expect(screen.getByTestId("page")).toBeEmptyDOMElement();
  });
});
