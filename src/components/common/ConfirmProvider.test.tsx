import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ConfirmProvider, useConfirm, type ConfirmOptions } from "./ConfirmProvider";

const deleteOptions: ConfirmOptions = {
  title: "Delete Policy",
  message: "Delete the travel policy?",
  confirmLabel: "Delete",
  destructive: true,
};

/** Asks for confirmation and shows each answer it receives. */
function ConfirmHarness() {
  const confirm = useConfirm();
  const [answers, setAnswers] = useState<string[]>([]);
  const ask = async (options: ConfirmOptions) => {
    const answer = await confirm(options);
    setAnswers((current) => [...current, `${options.title}: ${answer}`]);
  };

  return (
    <>
      <button onClick={() => void ask(deleteOptions)}>Ask</button>
      <button onClick={() => void ask({ title: "Second", message: "Another question?" })}>Ask Again</button>
      <output>{answers.join(" | ")}</output>
    </>
  );
}

function renderHarness() {
  render(
    <ConfirmProvider>
      <ConfirmHarness />
    </ConfirmProvider>,
  );
  return userEvent.setup();
}

describe("ConfirmProvider", () => {
  it("shows the requested title, message and labels", async () => {
    const user = renderHarness();

    await user.click(screen.getByRole("button", { name: "Ask" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete Policy" });
    expect(dialog).toHaveTextContent("Delete the travel policy?");
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("resolves true when confirmed", async () => {
    const user = renderHarness();

    await user.click(screen.getByRole("button", { name: "Ask" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Delete Policy: true")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("resolves false when cancelled or dismissed with Escape", async () => {
    const user = renderHarness();

    await user.click(screen.getByRole("button", { name: "Ask" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Delete Policy: false")).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(await screen.findByText("Delete Policy: false | Delete Policy: false")).toBeInTheDocument();
  });

  it("answers an unanswered question with false when a new one is asked", async () => {
    const user = renderHarness();

    await user.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByRole("dialog", { name: "Delete Policy" });
    // The open dialog makes the page inert, so the second request is made directly.
    screen.getByRole("button", { name: "Ask Again", hidden: true }).click();

    expect(await screen.findByText("Delete Policy: false")).toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Second" })).toBeInTheDocument();
  });
});
