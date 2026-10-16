import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ErrorState } from "./ErrorState";

const apiError = (status: number, message: string) => ({ status, code: "ANY", message });

describe("ErrorState", () => {
  it.each([
    [401, "Session expired"],
    [403, "Access denied"],
    [404, "Not found"],
    [409, "Conflict"],
    [422, "Request not accepted"],
    [500, "An unexpected error occurred"],
  ])("titles a %s failure \"%s\" and shows the server message", (status, title) => {
    render(<ErrorState error={apiError(status, "The server explained what happened.")} />);

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("The server explained what happened.");
  });

  it("offers Retry for failures a retry can fix", async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={apiError(500, "Temporarily unavailable.")} onRetry={onRetry} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it.each([401, 403, 404])("does not offer Retry for a %s failure", (status) => {
    render(<ErrorState error={apiError(status, "Not allowed.")} onRetry={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("falls back to a general message when the error has no details", () => {
    render(<ErrorState error={new Error("boom")} />);

    expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();
    expect(screen.getByText("This information could not be loaded. Please try again.")).toBeInTheDocument();
  });
});
