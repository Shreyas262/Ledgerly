import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage, setupPageTests } from "../../../test/renderPage";
import { UsersPage } from "./UsersPage";

setupPageTests();

function renderUsers() {
  return renderPage(<UsersPage />, { path: "/users", as: "admin" });
}

/** The card of a listed user, found by name. */
async function userCard(name: string): Promise<HTMLElement> {
  const heading = await screen.findByText(name);
  return heading.closest(".MuiCard-root") as HTMLElement;
}

describe("UsersPage edit dialog", () => {
  it("shows the selected user's details, and another user's when a different one is edited", async () => {
    const { user } = await renderUsers();

    await user.click(within(await userCard("John Employee")).getByRole("button", { name: "Edit" }));
    let dialog = await screen.findByRole("dialog", { name: "Edit User" });
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("John Employee");
    expect(within(dialog).getByRole("textbox", { name: "Email" })).toHaveValue("employee@ledgerly.com");

    await user.type(within(dialog).getByRole("textbox", { name: "Name" }), " (draft)");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(within(await userCard("Sarah Manager")).getByRole("button", { name: "Edit" }));
    dialog = await screen.findByRole("dialog", { name: "Edit User" });
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Sarah Manager");
    expect(within(dialog).getByRole("textbox", { name: "Email" })).toHaveValue("manager@ledgerly.com");
  });
});
